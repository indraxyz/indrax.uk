import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { mkdtemp, readFile, writeFile, appendFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { getDeploymentTarget, assertTargetOrigin } from "../config/deployment-targets.mjs"
import { verifyDeploymentTarget } from "./assert-deploy-target.mjs"

const execute = promisify(execFile)
const identifier = /^[a-zA-Z0-9-]{1,80}$/

/** Read Wrangler's versioned JSONL output, never its potentially sensitive stdout. */
export function stagingDeploymentRecord(output, sha) {
  if (!/^[a-f0-9]{40}$/.test(sha ?? "")) throw new Error("A full commit SHA is required.")
  const entries = output
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line))
  const records = entries.filter((entry) => entry.type === "preview")
  if (records.length !== 1) throw new Error("Expected exactly one Preview deployment record.")
  const entry = records[0]
  const target = getDeploymentTarget("staging")
  if (
    entry.version !== 1 ||
    entry.worker_name !== target.workerName ||
    entry.preview_name !== target.previewName ||
    !identifier.test(entry.deployment_id ?? "") ||
    !identifier.test(entry.preview_id ?? "")
  )
    throw new Error("Unexpected Preview deployment identity.")
  if (!Array.isArray(entry.preview_urls) || !entry.preview_urls.includes(target.siteUrl))
    throw new Error("The configured stable staging URL is not active.")
  assertTargetOrigin("staging", target.siteUrl)
  const stable = new URL(target.siteUrl)
  const baseHostname = stable.hostname.slice(target.previewName.length + 1)
  const shortId = entry.deployment_id.slice(0, 8)
  // The live Preview API also returns <short-id>.<base-domain>. Accept only
  // hostnames derived from this deployment, including the documented form.
  const deploymentHosts = new Set([
    `${shortId}.${baseHostname}`,
    `${shortId}-${stable.hostname}`,
    `${entry.deployment_id}-${stable.hostname}`,
  ])
  const deploymentUrl = entry.deployment_urls?.find((value) => {
    try {
      const url = new URL(value)
      return (
        url.protocol === "https:" &&
        !url.username &&
        !url.password &&
        url.port === "" &&
        url.pathname === "/" &&
        !url.search &&
        !url.hash &&
        deploymentHosts.has(url.hostname)
      )
    } catch {
      return false
    }
  })
  if (!deploymentUrl) throw new Error("A valid unique staging deployment URL is required.")
  return {
    worker: target.workerName,
    preview: target.previewName,
    sha,
    deploymentId: entry.deployment_id,
    previewId: entry.preview_id,
    url: target.siteUrl,
    deploymentUrl,
  }
}

export async function deployStaging({ env = process.env, run = execute } = {}) {
  await verifyDeploymentTarget("staging")
  const sha = env.GITHUB_SHA || (await run("git", ["rev-parse", "HEAD"])).stdout.trim()
  if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error("A full commit SHA is required.")
  const directory = await mkdtemp(join(tmpdir(), "indrax-preview-deploy-"))
  try {
    const outputPath = join(directory, "output.jsonl")
    const wrangler = fileURLToPath(
      new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url)
    )
    try {
      await run(
        process.execPath,
        [
          wrangler,
          "preview",
          "--config",
          "build/server/wrangler.json",
          "--name",
          "develop",
          "--tag",
          sha,
          "--json",
        ],
        {
          env: { ...env, CLOUDFLARE_ENV: "", WRANGLER_OUTPUT_FILE_PATH: outputPath },
          maxBuffer: 8 * 1024 * 1024,
        }
      )
    } catch {
      // Do not forward command stdout/stderr: API errors may include runtime bindings.
      throw new Error("Staging Preview upload failed. Inspect the private Wrangler log.")
    }
    const record = stagingDeploymentRecord(await readFile(outputPath, "utf8"), sha)
    await writeFile("build/staging-deployment.json", JSON.stringify(record, null, 2) + "\n")
    if (env.GITHUB_OUTPUT)
      await appendFile(
        env.GITHUB_OUTPUT,
        `url=${record.url}\ndeployment_id=${record.deploymentId}\n`
      )
    if (env.GITHUB_STEP_SUMMARY)
      await appendFile(
        env.GITHUB_STEP_SUMMARY,
        `### Staging Preview uploaded\n\nWorker: \`${record.worker}\`; Preview: \`${record.preview}\`\n\nCommit: \`${record.sha}\`\n\nDeployment: \`${record.deploymentId}\`\n\n[Stable Preview](${record.url}) · [Unique deployment](${record.deploymentUrl})\n\nUpload is followed by security, analytics (when enabled), and cleanup checks.\n`
      )
    console.log(JSON.stringify(record, null, 2))
    return record
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await deployStaging()
