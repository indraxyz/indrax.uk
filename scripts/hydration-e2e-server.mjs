import { spawn } from "node:child_process"
import { unstable_readConfig } from "wrangler"
import { prepareHydrationEnvironment } from "./hydration-env.mjs"
import { initializeLocalCache } from "./local-cache.mjs"

const root = process.cwd()
const source = unstable_readConfig({ config: "wrangler.jsonc", env: "" })
const fixture = await prepareHydrationEnvironment({ root, source })
let child
const stop = () => child?.kill("SIGTERM")
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, stop)
try {
  await initializeLocalCache(fixture.config, undefined, fixture.persist)
  child = spawn(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "--configLoader",
      "native",
      "--port",
      process.env.E2E_PORT ?? "3210",
      "--strictPort",
    ],
    { stdio: "inherit", env: fixture.env }
  )
  process.exitCode = await new Promise((resolveExit, reject) => {
    child.on("error", reject)
    child.on("exit", (code) => resolveExit(code ?? 0))
  })
} finally {
  for (const signal of ["SIGINT", "SIGTERM"]) process.removeListener(signal, stop)
  await fixture.cleanup()
}
