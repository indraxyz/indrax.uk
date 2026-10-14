import { spawn } from "node:child_process"
import { createRequire } from "node:module"
import { fileURLToPath, pathToFileURL } from "node:url"
import { readFile } from "node:fs/promises"

const require = createRequire(import.meta.url)
export const wranglerPath = fileURLToPath(
  new URL(
    require("wrangler/package.json").bin.wrangler,
    pathToFileURL(require.resolve("wrangler/package.json"))
  )
)

/** Initialize only local D1 state; never provision or mutate a remote database. */
export async function initializeLocalCache(config, environment) {
  const analyticsSchema = await readFile(
    new URL("../config/analytics-quota.sql", import.meta.url),
    "utf8"
  )
  const args = [
    wranglerPath,
    "d1",
    "execute",
    "APP_D1",
    "--local",
    "--config",
    config,
    ...(environment ? ["--env", environment] : []),
    "--command",
    "CREATE TABLE IF NOT EXISTS revalidations (tag TEXT PRIMARY KEY, revalidatedAt INTEGER NOT NULL);" +
      analyticsSchema,
  ]
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { stdio: "inherit", env: process.env })
    child.on("error", reject)
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error("Local D1 initialization failed."))
    )
  })
}
