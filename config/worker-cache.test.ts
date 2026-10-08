import { readFileSync } from "node:fs"
import { parseConfigFileTextToJson } from "typescript"
import { expect, it } from "vitest"

import openNextConfig from "../open-next.config"

it("uses persistent data and Next-mode tag caches with cache interception", async () => {
  const overrides = openNextConfig.default?.override
  const incremental = overrides?.incrementalCache
  const tags = overrides?.tagCache
  const queue = overrides?.queue
  expect(typeof incremental === "function" ? await incremental() : incremental).toMatchObject({
    name: "cf-kv-incremental-cache",
  })
  expect(typeof tags === "function" ? await tags() : tags).toMatchObject({
    name: "d1-next-mode-tag-cache",
    mode: "nextMode",
  })
  expect(typeof queue === "function" ? await queue() : queue).toMatchObject({
    name: "memory-queue",
  })
  expect(openNextConfig.dangerous?.enableCacheInterception).toBe(true)
})

it("keeps cache resources and self references separate for production and dev", () => {
  const parsed = parseConfigFileTextToJson("wrangler.jsonc", readFileSync("wrangler.jsonc", "utf8"))
  expect(parsed.error).toBeUndefined()
  const production = parsed.config
  const dev = production.env.dev

  for (const config of [production, dev]) {
    expect(config.kv_namespaces).toContainEqual(
      expect.objectContaining({ binding: "NEXT_INC_CACHE_KV" })
    )
    expect(config.d1_databases).toContainEqual(
      expect.objectContaining({ binding: "NEXT_TAG_CACHE_D1" })
    )
  }

  for (const config of [production, dev]) {
    expect(config.kv_namespaces[0].id).toMatch(/^[a-f0-9]{32}$/)
    expect(config.d1_databases[0].database_id).toMatch(
      /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/
    )
  }
  expect(production.kv_namespaces[0].id).not.toBe(dev.kv_namespaces[0].id)
  expect(production.d1_databases[0].database_id).not.toBe(dev.d1_databases[0].database_id)
  expect(production.d1_databases[0].database_name).not.toBe(dev.d1_databases[0].database_name)
  expect(production.services).toContainEqual({
    binding: "WORKER_SELF_REFERENCE",
    service: "indrax",
  })
  expect(dev.services).toContainEqual({ binding: "WORKER_SELF_REFERENCE", service: "indrax-dev" })
})
