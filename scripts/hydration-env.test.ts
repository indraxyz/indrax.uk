import { readFile, stat } from "node:fs/promises"
import { dirname, join } from "node:path"
import { parseEnv } from "node:util"
import { afterEach, expect, it } from "vitest"
import { prepareHydrationEnvironment } from "./hydration-env.mjs"

const source = {
  main: "workers/app.ts",
  compatibility_date: "2026-09-01",
  compatibility_flags: ["nodejs_compat"],
  assets: { directory: "build/client", binding: "ASSETS" },
  vars: { SITE_URL: "https://example.test" },
  kv_namespaces: [{ binding: "CACHE_KV", id: "fixture-kv" }],
  d1_databases: [{ binding: "APP_D1", database_name: "fixture-db", database_id: "fixture-id" }],
}
const fixtures: Array<{ cleanup: () => Promise<void> }> = []
afterEach(async () => {
  await Promise.all(fixtures.splice(0).map((fixture) => fixture.cleanup()))
})
const prepare = async (env: Record<string, string> = {}) => {
  const fixture = await prepareHydrationEnvironment({ root: process.cwd(), source, env })
  fixtures.push(fixture)
  return fixture
}

it("forwards the loopback database to the Worker without forwarding unrelated shell credentials", async () => {
  const database = "postgres://fixture:password@127.0.0.1:4451/fixture?sslmode=require"
  const fixture = await prepare({
    DATABASE_URL: database,
    GITHUB_TOKEN: "must-stay-out-of-worker",
    CLOUDFLARE_ENV: "dev",
  })
  const directory = dirname(fixture.config)
  expect(parseEnv(await readFile(join(directory, ".dev.vars"), "utf8"))).toEqual({
    DATABASE_URL: database,
  })
  const config = JSON.parse(await readFile(fixture.config, "utf8"))
  expect(config).toMatchObject({
    main: join(process.cwd(), "workers/app.ts"),
    workers_dev: false,
    preview_urls: false,
    assets: { directory: join(process.cwd(), "public"), binding: "ASSETS" },
    kv_namespaces: source.kv_namespaces,
    d1_databases: source.d1_databases,
  })
  expect(JSON.stringify(config)).not.toContain("must-stay-out-of-worker")
  expect(fixture.env).toMatchObject({
    CLOUDFLARE_ENV: "",
    CLOUDFLARE_VITE_WRANGLER_CONFIG_PATH: fixture.config,
    CLOUDFLARE_VITE_FORCE_LOCAL: "true",
    CLOUDFLARE_INCLUDE_PROCESS_ENV: "false",
    INDRAX_VITE_PERSIST_DIR: fixture.persist,
    ANALYTICS_ENABLED: "true",
    ANALYTICS_TRANSPORT: "worker",
  })
  expect((await stat(fixture.config)).mode & 0o777).toBe(0o600)
  expect((await stat(join(directory, ".dev.vars"))).mode & 0o777).toBe(0o600)
  await fixture.cleanup()
  await expect(stat(directory)).rejects.toMatchObject({ code: "ENOENT" })
})

it("uses independent cache and persistence directories for separate browser runs", async () => {
  const first = await prepare()
  const second = await prepare()
  expect(first.persist).not.toBe(second.persist)
  expect(first.env.INDRAX_VITE_CACHE_DIR).not.toBe(second.env.INDRAX_VITE_CACHE_DIR)
  expect(await readFile(join(dirname(first.config), ".dev.vars"), "utf8")).toBe("")
})

it.each(["postgres://fixture:password@remote.example.test/db", "not-a-database-url"])(
  "rejects a remote or invalid test database: %s",
  async (database) => {
    await expect(prepare({ DATABASE_URL: database })).rejects.toThrow()
  }
)
