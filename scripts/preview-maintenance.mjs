import { pathToFileURL } from "node:url"
import { getDeploymentTarget, assertTargetOrigin } from "../config/deployment-targets.mjs"

/** This is a machine caller. It must never follow redirects carrying its bearer token. */
export async function invokePreviewCleanup({ origin, token, fetcher = fetch }) {
  assertTargetOrigin("staging", origin)
  if (typeof token !== "string" || token.length < 32 || token.length > 512 || /\s/.test(token))
    throw new Error("Configure a staging maintenance token of 32–512 non-whitespace characters.")
  let response
  try {
    response = await fetcher(`${origin}/api/internal/preview/media-cleanup`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: "{}",
      redirect: "manual",
      credentials: "omit",
      signal: AbortSignal.timeout(60_000),
    })
  } catch {
    throw new Error(
      "Staging cleanup request failed or timed out; inspect tracked work before retrying."
    )
  }
  try {
    if (response.status !== 200 || !response.headers.get("cache-control")?.includes("no-store"))
      throw new Error(`Staging cleanup failed: HTTP ${response.status}.`)
    const result = await response.json()
    if (result?.ok !== true) throw new Error("Staging cleanup returned an invalid result.")
  } finally {
    if (!response.bodyUsed) await response.body?.cancel()
  }
  console.log("Staging cleanup invocation completed; retained retries may remain.")
}

/** Validate manual maintenance against the current branch and recorded successful deployment. */
export async function verifyMaintenanceRevision({ repository, sha, githubToken, fetcher = fetch }) {
  if (
    !/^[\w.-]+\/[\w.-]+$/.test(repository ?? "") ||
    !/^[a-f0-9]{40}$/.test(sha ?? "") ||
    !githubToken
  )
    throw new Error("Repository, expected full commit SHA and GitHub token are required.")
  const read = async (path) => {
    const response = await fetcher(`https://api.github.com/repos/${repository}/${path}`, {
      headers: {
        authorization: `Bearer ${githubToken}`,
        accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    })
    if (!response.ok)
      throw new Error(`GitHub maintenance preflight failed: HTTP ${response.status}.`)
    return response.json()
  }
  const head = await read("git/ref/heads/develop")
  if (head.object?.sha !== sha)
    throw new Error("Expected revision is not the current develop head.")
  const deployments = await read("deployments?environment=Preview&per_page=30")
  if (!Array.isArray(deployments)) throw new Error("Invalid GitHub deployment response.")
  for (const deployment of deployments) {
    if (!Number.isSafeInteger(deployment.id)) throw new Error("Invalid GitHub deployment ID.")
    const statuses = await read(`deployments/${deployment.id}/statuses?per_page=1`)
    const status = statuses[0]
    if (
      status?.state !== "success" ||
      deployment.sha !== sha ||
      status.environment_url !== getDeploymentTarget("staging").siteUrl
    )
      throw new Error(
        "The latest completed Preview deployment is not successful for this revision and origin."
      )
    return
  }
  throw new Error("No successful staging Preview deployment was found.")
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv[2] === "--verify-revision")
    await verifyMaintenanceRevision({
      repository: process.env.GITHUB_REPOSITORY,
      sha: process.env.EXPECTED_STAGING_SHA,
      githubToken: process.env.GH_TOKEN,
    })
  else if (process.argv.length > 2) throw new Error("Unknown maintenance argument.")
  await invokePreviewCleanup({
    origin: getDeploymentTarget("staging").siteUrl,
    token: process.env.PREVIEW_MAINTENANCE_TOKEN,
  })
}
