import { spawn } from "node:child_process"
import { createRequire } from "node:module"
import { fileURLToPath, pathToFileURL } from "node:url"

const require = createRequire(import.meta.url)
export const wranglerPath = fileURLToPath(
  new URL(
    require("wrangler/package.json").bin.wrangler,
    pathToFileURL(require.resolve("wrangler/package.json"))
  )
)

/** Initialize only local D1 state; never provision or mutate a remote database. */
export async function initializeLocalCache(config, environment) {
  const args = [
    wranglerPath,
    "d1",
    "execute",
    "NEXT_TAG_CACHE_D1",
    "--local",
    "--config",
    config,
    ...(environment ? ["--env", environment] : []),
    "--command",
    "CREATE TABLE IF NOT EXISTS revalidations (tag TEXT PRIMARY KEY, revalidatedAt INTEGER NOT NULL);",
  ]
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { stdio: "inherit", env: process.env })
    child.on("error", reject)
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error("Local D1 initialization failed."))
    )
  })
}
