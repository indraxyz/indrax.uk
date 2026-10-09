import { spawn } from "node:child_process"
import { initializeLocalCache } from "./local-cache.mjs"
import { createRequire } from "node:module"
import { fileURLToPath, pathToFileURL } from "node:url"
const require = createRequire(import.meta.url)
const vite = fileURLToPath(
  new URL(
    require("vite/package.json").bin.vite,
    pathToFileURL(require.resolve("vite/package.json"))
  )
)

await initializeLocalCache("wrangler.jsonc", process.env.CLOUDFLARE_ENV)

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
  spawn(process.execPath, [vite, ...process.argv.slice(2)], { stdio: "inherit" }),
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
