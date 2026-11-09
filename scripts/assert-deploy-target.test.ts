import { expect, it, vi } from "vitest"
import {
  assertBuildManifest,
  assertDeploymentTarget,
  assertStagingIsolation,
  verifyDeploymentTarget,
} from "./assert-deploy-target.mjs"
import { getDeploymentTarget } from "../config/deployment-targets.mjs"

const readConfig = vi.hoisted(() => vi.fn())
const readFile = vi.hoisted(() => vi.fn())
vi.mock("wrangler", () => ({ unstable_readConfig: readConfig }))
vi.mock("node:fs/promises", () => ({ readFile }))

const target = {
  name: "worker",
  workers_dev: false,
  preview_urls: false,
  observability: {
    enabled: true,
    redact_query_string: true,
    logs: { enabled: true, head_sampling_rate: 1, invocation_logs: true, persist: true },
    traces: { enabled: true, head_sampling_rate: 1, persist: false },
  },
  triggers: { crons: ["17 * * * *"] },
  r2_buckets: [{ binding: "MEDIA_BUCKET", bucket_name: "media-prod" }],
  routes: [{ pattern: "example.test", custom_domain: true }],
  vars: {
    SITE_URL: "https://example.test",
    MEDIA_ORIGIN: "https://media.example.test",
  },
  kv_namespaces: [{ binding: "CACHE_KV", id: "kv-prod" }],
  d1_databases: [{ binding: "APP_D1", database_id: "d1-prod", database_name: "revisions" }],
  assets: { binding: "ASSETS", directory: "../client" },
  ratelimits: [
    { name: "RATE_LIMIT_API", namespace_id: "1002", simple: { limit: 120, period: 60 } },
  ],
}

const production = {
  ...target,
  name: getDeploymentTarget("production").workerName,
  vars: {
    SITE_URL: getDeploymentTarget("production").siteUrl,
    MEDIA_ORIGIN: getDeploymentTarget("production").mediaOrigin,
  },
}

it("accepts resolved source and generated config with the same deployment boundaries", () => {
  expect(() =>
    assertDeploymentTarget(
      { ...target, main: "index.js", vars: { ...target.vars, EXTRA: "value" } },
      target
    )
  ).not.toThrow()
})

it.each([
  { name: "worker-dev" },
  { workers_dev: true },
  { workers_dev: undefined },
  { preview_urls: true },
  { preview_urls: undefined },
  { observability: undefined },
  { observability: { ...target.observability, redact_query_string: false } },
  {
    observability: {
      ...target.observability,
      traces: { ...target.observability.traces, persist: true },
    },
  },
  { routes: [{ pattern: "example.test", custom_domain: true, enabled: false }] },
  { routes: [{ pattern: "example.test", custom_domain: true, previews_enabled: true }] },
  {
    ratelimits: [
      { name: "RATE_LIMIT_API", namespace_id: "2002", simple: { limit: 120, period: 60 } },
    ],
  },
  { vars: { ...target.vars, PREVIEW_MAINTENANCE_ENABLED: "true" } },
  { triggers: { crons: [] } },
  { triggers: { crons: ["47 * * * *"] } },
  { r2_buckets: [] },
  { r2_buckets: [{ binding: "MEDIA_BUCKET", bucket_name: "media-dev" }] },
  { vars: { ...target.vars, MEDIA_ORIGIN: "https://dev-media.example.test" } },
  { routes: [{ pattern: "dev.example.test", custom_domain: true }] },
  { vars: { SITE_URL: "https://dev.example.test" } },
  { kv_namespaces: [{ binding: "CACHE_KV", id: "kv-dev" }] },
  { d1_databases: [{ binding: "APP_D1", database_id: "d1-dev", database_name: "revisions" }] },
  { kv_namespaces: [{ binding: "STALE_CACHE", id: "kv-prod" }] },
  {
    d1_databases: [
      { binding: "STALE_DATABASE", database_id: "d1-prod", database_name: "revisions" },
    ],
  },
  { kv_namespaces: [] },
])("rejects mixed environment boundaries before upload: %j", (replacement) => {
  expect(() => assertDeploymentTarget({ ...target, ...replacement }, target)).toThrow(
    "Deployment target mismatch"
  )
})

it("ignores binding and route declaration order", () => {
  const expected = {
    ...target,
    routes: [...target.routes, { pattern: "www.example.test", custom_domain: true }],
    kv_namespaces: [...target.kv_namespaces, { binding: "SECOND", id: "second" }],
  }
  expect(() =>
    assertDeploymentTarget(
      {
        ...expected,
        routes: [...expected.routes].reverse(),
        kv_namespaces: [...expected.kv_namespaces].reverse(),
      },
      expected
    )
  ).not.toThrow()
})

it("resolves production and generated configs explicitly despite an inherited environment", async () => {
  readConfig.mockReset().mockReturnValue(production)
  readFile.mockResolvedValue(
    JSON.stringify({ target: "production", ...getDeploymentTarget("production") })
  )
  const log = vi.spyOn(console, "log").mockImplementation(() => {})
  try {
    await verifyDeploymentTarget("production")
    expect(readConfig.mock.calls).toEqual([
      [{ config: "wrangler.jsonc", env: "" }],
      [{ config: "build/server/wrangler.json", env: "" }],
    ])
  } finally {
    log.mockRestore()
  }
})

it("rejects the retired dev target before loading configuration", async () => {
  readConfig.mockReset()
  await expect(verifyDeploymentTarget("dev")).rejects.toThrow("Choose production or staging")
  expect(readConfig).not.toHaveBeenCalled()
})

it("rejects unknown deployment targets before loading config", async () => {
  readConfig.mockReset()
  await expect(verifyDeploymentTarget("preview")).rejects.toThrow("Choose production or staging")
  expect(readConfig).not.toHaveBeenCalled()
})

const preview = {
  vars: {
    SITE_URL: getDeploymentTarget("staging").siteUrl,
    BETTER_AUTH_URL: getDeploymentTarget("staging").siteUrl,
    MEDIA_ORIGIN: getDeploymentTarget("staging").mediaOrigin,
    PREVIEW_MAINTENANCE_ENABLED: "true",
  },
  kv_namespaces: [{ binding: "CACHE_KV", id: "kv-dev" }],
  d1_databases: [{ binding: "APP_D1", database_id: "d1-dev", database_name: "revisions-dev" }],
  r2_buckets: [{ binding: "MEDIA_BUCKET", bucket_name: "media-dev" }],
  ratelimits: [
    { name: "RATE_LIMIT_API", namespace_id: "2002", simple: { limit: 120, period: 60 } },
  ],
}

it("compares staging bindings under the parent Worker and requires its build manifest", async () => {
  readConfig.mockReset().mockReturnValue({ ...target, name: "indrax", previews: preview })
  readFile.mockResolvedValue(
    JSON.stringify({ target: "staging", ...getDeploymentTarget("staging") })
  )
  await expect(verifyDeploymentTarget("staging")).resolves.toBeUndefined()
  expect(readConfig.mock.calls[0]).toEqual([{ config: "wrangler.jsonc", env: "" }])
  readFile.mockResolvedValue(
    JSON.stringify({ target: "production", ...getDeploymentTarget("production") })
  )
  await expect(verifyDeploymentTarget("staging")).rejects.toThrow("Build manifest")
})

it.each(["kv_namespaces", "d1_databases", "r2_buckets", "ratelimits"] as const)(
  "rejects shared production resources in %s independently of source comparison",
  (field) => {
    expect(() => assertStagingIsolation(target, { ...preview, [field]: target[field] })).toThrow(
      "isolated"
    )
    expect(() => assertStagingIsolation(target, { ...preview, [field]: [] })).toThrow("isolated")
  }
)

it("refuses staging routes, Cron and production maintenance capability", () => {
  expect(() => assertStagingIsolation(target, { ...preview, routes: target.routes })).toThrow(
    "routes"
  )
  expect(() => assertStagingIsolation(target, { ...preview, triggers: target.triggers })).toThrow(
    "Cron"
  )
  expect(() =>
    assertStagingIsolation({ ...target, vars: { PREVIEW_MAINTENANCE_ENABLED: "true" } }, preview)
  ).toThrow("Production")
})

it("requires the explicit target in the artifact manifest", () => {
  expect(() => assertBuildManifest({ target: "local" }, "production")).toThrow("Build manifest")
  expect(() =>
    assertBuildManifest(
      { target: "staging", ...getDeploymentTarget("staging"), siteUrl: "https://indrax.uk" },
      "staging"
    )
  ).toThrow("Build manifest")
})

it.each(["production"])(
  "rejects source and generated identity drift against the fixed %s build contract",
  async (name) => {
    const identity = getDeploymentTarget(name)
    const valid = {
      ...production,
      name: identity.workerName,
      vars: { SITE_URL: identity.siteUrl, MEDIA_ORIGIN: identity.mediaOrigin },
    }
    readFile.mockResolvedValue(JSON.stringify({ target: name, ...identity }))
    for (const changed of [
      { ...valid, name: "unintended-worker" },
      { ...valid, vars: { ...valid.vars, SITE_URL: "https://unintended.example" } },
      { ...valid, vars: { ...valid.vars, MEDIA_ORIGIN: "https://unintended-media.example" } },
    ]) {
      readConfig.mockReset().mockReturnValue(changed)
      await expect(verifyDeploymentTarget(name)).rejects.toThrow("Worker identity")
    }
  }
)

it("checks the Preview subtree when validating a production deployment", async () => {
  const source = { ...production, previews: preview }
  readConfig
    .mockReset()
    .mockReturnValueOnce(source)
    .mockReturnValueOnce({
      ...source,
      previews: { ...preview, vars: { ...preview.vars, SITE_URL: "https://wrong.example" } },
    })
  await expect(verifyDeploymentTarget("production")).rejects.toThrow(
    "Deployment target mismatch: siteUrl"
  )
  readConfig.mockReset().mockReturnValueOnce(source).mockReturnValueOnce(production)
  await expect(verifyDeploymentTarget("production")).rejects.toThrow(
    "Preview settings must be preserved"
  )
})
