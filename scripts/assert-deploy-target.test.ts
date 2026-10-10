import { expect, it, vi } from "vitest"
import { assertDeploymentTarget, verifyDeploymentTarget } from "./assert-deploy-target.mjs"

const readConfig = vi.hoisted(() => vi.fn())
vi.mock("wrangler", () => ({ unstable_readConfig: readConfig }))

const target = {
  name: "worker",
  routes: [{ pattern: "example.test", custom_domain: true }],
  vars: { NEXT_PUBLIC_SITE_URL: "https://example.test" },
  kv_namespaces: [{ binding: "PUBLIC_CACHE", id: "kv-prod" }],
  d1_databases: [{ binding: "REVISIONS", database_id: "d1-prod", database_name: "revisions" }],
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
  { routes: [{ pattern: "dev.example.test", custom_domain: true }] },
  { vars: { NEXT_PUBLIC_SITE_URL: "https://dev.example.test" } },
  { kv_namespaces: [{ binding: "PUBLIC_CACHE", id: "kv-dev" }] },
  { d1_databases: [{ binding: "REVISIONS", database_id: "d1-dev", database_name: "revisions" }] },
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
  readConfig.mockReset().mockReturnValue(target)
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

it("resolves development source explicitly and rejects a production artifact", async () => {
  readConfig.mockReset()
  readConfig.mockReturnValueOnce({ ...target, name: "worker-dev" }).mockReturnValueOnce(target)
  await expect(verifyDeploymentTarget("dev")).rejects.toThrow("Deployment target mismatch: name")
  expect(readConfig.mock.calls).toEqual([
    [{ config: "wrangler.jsonc", env: "dev" }],
    [{ config: "build/server/wrangler.json", env: "" }],
  ])
})

it("rejects unknown deployment targets before loading config", async () => {
  readConfig.mockReset()
  await expect(verifyDeploymentTarget("staging")).rejects.toThrow("Choose production or dev")
  expect(readConfig).not.toHaveBeenCalled()
})
