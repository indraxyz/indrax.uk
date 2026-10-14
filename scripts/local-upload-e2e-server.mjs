import { spawn } from "node:child_process"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { unstable_readConfig } from "wrangler"

const database = new URL(process.env.DATABASE_URL ?? "")
if (!["localhost", "127.0.0.1", "[::1]"].includes(database.hostname))
  throw new Error("Upload browser tests require a loopback database.")

const directory = await mkdtemp(join(tmpdir(), "indrax-upload-browser-"))
const source = unstable_readConfig({ config: "wrangler.jsonc", env: "" })
const config = join(directory, "wrangler.json")
const values = Object.fromEntries(
  [
    "DATABASE_URL",
    "BETTER_AUTH_SECRET",
    "BETTER_AUTH_URL",
    "ALLOWED_GITHUB_ID",
    "GITHUB_CLIENT_ID",
    "GITHUB_CLIENT_SECRET",
    "MEDIA_ORIGIN",
  ].map((name) => [name, process.env[name]])
)
let child
const stop = () => child?.kill("SIGTERM")
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, stop)
try {
  // A private config and .dev.vars keep fixtures out of the user's configuration.
  // Cloudflare's Vite plugin provides this config-path override itself.
  await writeFile(
    config,
    JSON.stringify({
      name: "indrax-upload-browser",
      main: resolve(source.main),
      compatibility_date: source.compatibility_date,
      compatibility_flags: source.compatibility_flags,
      workers_dev: false,
      preview_urls: false,
      assets: { ...source.assets, directory: resolve("public") },
      r2_buckets: [
        { binding: "MEDIA_BUCKET", bucket_name: `indrax-upload-browser-${crypto.randomUUID()}` },
      ],
      vars: { SITE_URL: process.env.BETTER_AUTH_URL },
    }),
    { mode: 0o600 }
  )
  await writeFile(
    join(directory, ".dev.vars"),
    Object.entries(values)
      .map(([name, value]) => `${name}=${JSON.stringify(value)}`)
      .join("\n") + "\n",
    { mode: 0o600 }
  )
  child = spawn(
    process.execPath,
    ["scripts/dev.mjs", "--port", process.env.E2E_PORT ?? "3210", "--strictPort"],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        CLOUDFLARE_VITE_WRANGLER_CONFIG_PATH: config,
        CLOUDFLARE_VITE_FORCE_LOCAL: "true",
        INDRAX_VITE_CACHE_DIR: join(directory, "vite-cache"),
        INDRAX_VITE_PERSIST_DIR: join(directory, "workers-state"),
      },
    }
  )
  process.exitCode = await new Promise((resolveExit, reject) => {
    child.on("error", reject)
    child.on("exit", (code) => resolveExit(code ?? 0))
  })
} finally {
  for (const signal of ["SIGINT", "SIGTERM"]) process.removeListener(signal, stop)
  await rm(directory, { recursive: true, force: true })
}
