import { spawn } from "node:child_process"
import { initializeLocalCache, wranglerPath } from "./local-cache.mjs"
import { writeFile, rm } from "node:fs/promises"

const index = process.argv.indexOf("--port")
const port = index === -1 ? process.env.PORT || "3000" : process.argv[index + 1]
// CI uses an ephemeral local database. Real preview secrets belong in .dev.vars;
// never serialize production environment credentials into a build artifact.
const database = process.env.DATABASE_URL
const testVars = "build/server/.dev.vars"
let createdTestVars = false
if (database && ["127.0.0.1", "localhost"].includes(new URL(database).hostname)) {
  const names = [
    "DATABASE_URL",
    "BETTER_AUTH_SECRET",
    "BETTER_AUTH_URL",
    "ALLOWED_GITHUB_ID",
    "GITHUB_CLIENT_ID",
    "GITHUB_CLIENT_SECRET",
    "NEXT_PUBLIC_MEDIA_ORIGIN",
  ]
  const vars = names
    .filter((name) => process.env[name] !== undefined)
    .map((name) => `${name}=${JSON.stringify(process.env[name])}`)
    .join("\n")
  await writeFile(testVars, vars + "\n", { flag: "w", mode: 0o600 })
  createdTestVars = true
}
await initializeLocalCache("build/server/wrangler.json")
const child = spawn(
  process.execPath,
  [
    wranglerPath,
    "dev",
    "--local",
    // Wrangler otherwise uses the production route host as the inner origin
    // and rewrites browser Origin headers to it. Keep local requests and strict
    // Better Auth/CSRF checks on the same loopback origin, including its port.
    "--local-upstream",
    `127.0.0.1:${port}`,
    "--upstream-protocol",
    "http",
    "--config",
    "build/server/wrangler.json",
    "--port",
    port,
    "--ip",
    "127.0.0.1",
  ],
  { stdio: "inherit", env: process.env }
)
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal))
child.on("exit", async (code) => {
  if (createdTestVars) await rm(testVars, { force: true })
  process.exit(code ?? 1)
})
