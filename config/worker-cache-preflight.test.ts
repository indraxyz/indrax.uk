import { spawnSync } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { expect, it } from "vitest"

const script = fileURLToPath(new URL("../scripts/check-worker-cache.mjs", import.meta.url))

function check(config: unknown, environment = "") {
  const directory = mkdtempSync(join(tmpdir(), "indrax-cache-preflight-"))
  try {
    writeFileSync(join(directory, "wrangler.jsonc"), JSON.stringify(config))
    return spawnSync(process.execPath, [script, environment], { cwd: directory, encoding: "utf8" })
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

const configured = {
  kv_namespaces: [{ binding: "NEXT_INC_CACHE_KV", id: "a".repeat(32) }],
  d1_databases: [{ binding: "NEXT_TAG_CACHE_D1", database_id: "database-id" }],
}

it("allows a configured production cache", () => {
  expect(check(configured).status).toBe(0)
})

it("checks dev bindings without falling back to production resources", () => {
  const missingDev = check({ ...configured, env: { dev: {} } }, "dev")
  expect(missingDev.status).not.toBe(0)
  expect(missingDev.stderr).toContain("not provisioned for dev")
  expect(check({ env: { dev: configured } }, "dev").status).toBe(0)
})

it("fails before release if either cache resource is missing", () => {
  for (const config of [
    { kv_namespaces: configured.kv_namespaces },
    { d1_databases: configured.d1_databases },
  ]) {
    const result = check(config)
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain("docs/worker-cpu-optimization.md")
  }
})

it("refuses an unknown deployment environment", () => {
  const result = check(configured, "unknown")
  expect(result.status).not.toBe(0)
  expect(result.stderr).toContain("Expected the default environment or dev")
})

it("refuses shared development and production cache resources", () => {
  const result = check({ ...configured, env: { dev: configured } }, "dev")
  expect(result.status).not.toBe(0)
  expect(result.stderr).toContain("must use separate Worker cache resources")
})
