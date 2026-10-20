import { spawn } from "node:child_process"
import { loadEnv } from "vite"
import { devAddress, hasAddressArgument } from "./dev-address.mjs"
import { initializeLocalCache } from "./local-cache.mjs"
import { createRequire } from "node:module"
import { fileURLToPath, pathToFileURL } from "node:url"
const require = createRequire(import.meta.url)

// An optional public origin (e.g. https://indrax.uk.test behind a local proxy) from
// .env.local. Explicit --host/--port arguments, as test runners pass, take priority.
const viteArgs = process.argv.slice(2)
const address = hasAddressArgument(viteArgs)
  ? null
  : devAddress(loadEnv("development", process.cwd(), "DEV_"))
const viteEnv = address
  ? {
      ...process.env,
      // Vite answers 403 to Host headers it does not recognise.
      __VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS: address.publicUrl.hostname,
      INDRAX_DEV_PUBLIC_URL: address.publicUrl.origin,
    }
  : process.env
if (address) viteArgs.push("--host", address.host, "--port", String(address.port), "--strictPort")
const vite = fileURLToPath(
  new URL(
    require("vite/package.json").bin.vite,
    pathToFileURL(require.resolve("vite/package.json"))
  )
)

const cacheConfig = process.env.CLOUDFLARE_VITE_WRANGLER_CONFIG_PATH ?? "wrangler.jsonc"
let hasCacheBinding = true
if (process.env.CLOUDFLARE_VITE_WRANGLER_CONFIG_PATH) {
  const { unstable_readConfig } = await import("wrangler")
  const config = unstable_readConfig({ config: cacheConfig, env: process.env.CLOUDFLARE_ENV })
  hasCacheBinding = config.d1_databases.some(({ binding }) => binding === "APP_D1")
}
if (hasCacheBinding) await initializeLocalCache(cacheConfig, process.env.CLOUDFLARE_ENV)

// Build the independent admin into Vite's public directory for the Worker asset
// binding, then watch it alongside the public Framework Mode dev server.
const args = [
  vite,
  "build",
  "--config",
  "vite.admin.config.ts",
  "--mode",
  "development",
  "--outDir",
  "../public/admin",
]
await new Promise((resolve, reject) => {
  const initial = spawn(process.execPath, args, { stdio: "inherit" })
  initial.on("error", reject)
  initial.on("exit", (code) =>
    code === 0 ? resolve() : reject(new Error("Admin development build failed."))
  )
})
const children = [
  spawn(process.execPath, [...args, "--watch"], { stdio: "inherit" }),
  spawn(process.execPath, [vite, ...viteArgs], { stdio: "inherit", env: viteEnv }),
]
let stopping = false
function stop(code) {
  if (stopping) return
  stopping = true
  for (const child of children) child.kill("SIGTERM")
  process.exitCode = code
}
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => stop(0))
for (const child of children) {
  child.on("error", () => stop(1))
  child.on("exit", (code) => stop(code ?? 1))
}
