import { spawn } from "node:child_process"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { initializeLocalCache, wranglerPath } from "./local-cache.mjs"
import { preparePreviewEnvironment } from "./preview-env.mjs"

const projectRoot = fileURLToPath(new URL("../", import.meta.url))

export async function runPreview({
  root = projectRoot,
  argv = process.argv.slice(2),
  env = /** @type {Record<string, string | undefined>} */ (process.env),
  launch = spawn,
  initializeCache = initializeLocalCache,
  signals = process,
} = {}) {
  const config = resolve(root, "build/server/wrangler.json")
  const index = argv.indexOf("--port")
  const port = index === -1 ? env.PORT || "3000" : argv[index + 1]
  if (!/^\d+$/.test(port ?? "") || Number(port) < 1 || Number(port) > 65535)
    throw new Error("Preview requires a port between 1 and 65535.")
  const environment = await preparePreviewEnvironment({ root, port, env })
  let child
  let interrupted
  const handlers = Object.fromEntries(
    ["SIGINT", "SIGTERM"].map((signal) => [
      signal,
      () => {
        interrupted = signal
        child?.kill(signal)
      },
    ])
  )
  for (const [signal, handler] of Object.entries(handlers)) signals.on(signal, handler)
  try {
    await initializeCache(config)
    if (interrupted) return interrupted === "SIGINT" ? 130 : 143
    child = launch(
      process.execPath,
      [
        wranglerPath,
        "dev",
        "--local",
        // Wrangler otherwise rewrites browser Origin to the production route host.
        // Keep the inner origin aligned with local Better Auth/CSRF checks.
        "--local-upstream",
        `127.0.0.1:${port}`,
        "--upstream-protocol",
        "http",
        "--config",
        config,
        ...environment.args,
        "--port",
        port,
        "--ip",
        "127.0.0.1",
      ],
      {
        stdio: "inherit",
        cwd: root,
        env: {
          ...env,
          CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: "true",
          CLOUDFLARE_INCLUDE_PROCESS_ENV: "false",
        },
      }
    )
    return await new Promise((resolveExit, reject) => {
      child.on("error", reject)
      child.on("exit", (code, signal) =>
        resolveExit(code ?? (signal === "SIGINT" ? 130 : signal === "SIGTERM" ? 143 : 1))
      )
    })
  } finally {
    for (const [signal, handler] of Object.entries(handlers))
      signals.removeListener(signal, handler)
    await environment.cleanup()
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  process.exitCode = await runPreview()
