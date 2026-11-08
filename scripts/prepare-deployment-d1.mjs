import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { mkdtemp, writeFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { getDeploymentTarget } from "../config/deployment-targets.mjs"
import { wranglerPath } from "./local-cache.mjs"

const execute = promisify(execFile)

/** @typedef {{binding: string, database_id?: string, database_name?: string}} D1Binding */
/** @typedef {{d1_databases?: D1Binding[], previews?: {d1_databases?: D1Binding[]}}} D1Source */

/** Bind the exact configured database without selecting or deploying any Worker. */
/** @param {D1Source} source
 * @param {string} target
 */
export function deploymentD1Config(source, target) {
  getDeploymentTarget(target)
  const bindings = (target === "staging" ? source.previews : source)?.d1_databases ?? []
  const matches = bindings.filter((binding) => binding.binding === "APP_D1")
  if (matches.length !== 1 || !matches[0].database_id || !matches[0].database_name)
    throw new Error("The deployment target requires one explicit APP_D1 database.")
  const database = matches[0]
  if (
    target === "staging" &&
    (source.d1_databases ?? []).some(
      (production) =>
        production.database_id === database.database_id ||
        production.database_name === database.database_name
    )
  )
    throw new Error("Staging D1 must be isolated from production.")
  return {
    d1_databases: [
      {
        binding: "APP_D1",
        database_id: database.database_id,
        database_name: database.database_name,
      },
    ],
  }
}

/** @param {string} target
 * @param {{source?: D1Source, run?: (command: string, args: string[], options: {env: NodeJS.ProcessEnv}) => Promise<{stdout?: string, stderr?: string}>}} options
 */
export async function prepareDeploymentD1(target, { run = execute, source } = {}) {
  getDeploymentTarget(target)
  if (!source) {
    const { unstable_readConfig } = await import("wrangler")
    source = unstable_readConfig({ config: "wrangler.jsonc", env: "" })
  }
  const config = deploymentD1Config(source, target)
  const directory = await mkdtemp(join(tmpdir(), "indrax-deployment-d1-"))
  try {
    const file = join(directory, "wrangler.json")
    await writeFile(file, JSON.stringify(config), { mode: 0o600 })
    const result = await run(
      process.execPath,
      [
        wranglerPath,
        "d1",
        "execute",
        "APP_D1",
        "--config",
        file,
        "--env",
        "",
        "--remote",
        "--file",
        resolve("config/analytics-quota.sql"),
        "--yes",
      ],
      { env: { ...process.env, CLOUDFLARE_ENV: "" } }
    )
    if (result.stdout) process.stdout.write(result.stdout)
    if (result.stderr) process.stderr.write(result.stderr)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await prepareDeploymentD1(process.argv[2])
