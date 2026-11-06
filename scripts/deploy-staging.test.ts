import { expect, it } from "vitest"
import { stagingDeploymentRecord } from "./deploy-staging.mjs"

const sha = "a".repeat(40)
const entry = {
  type: "preview",
  version: 1,
  worker_name: "indrax",
  preview_name: "develop",
  preview_id: "preview-id",
  deployment_id: "deployment-id",
  preview_urls: ["https://develop.previews.indrax.uk"],
  deployment_urls: ["https://deployment-id-develop.previews.indrax.uk"],
}

it("allowlists public deployment identity from Wrangler's versioned output", () => {
  const result = stagingDeploymentRecord(JSON.stringify({ ...entry, secret: "private-value" }), sha)
  expect(result).toEqual({
    worker: "indrax",
    preview: "develop",
    sha,
    previewId: "preview-id",
    deploymentId: "deployment-id",
    url: entry.preview_urls[0],
    deploymentUrl: entry.deployment_urls[0],
  })
  expect(JSON.stringify(result)).not.toContain("private-value")
})

it("accepts the live API's short deployment-ID hostname", () => {
  const actual = {
    ...entry,
    deployment_id: "d8ca8140-a587-47e0-8615-e64ceafc46a1",
    deployment_urls: ["https://d8ca8140.previews.indrax.uk"],
  }
  expect(stagingDeploymentRecord(JSON.stringify(actual), sha).deploymentUrl).toBe(
    actual.deployment_urls[0]
  )
  expect(() =>
    stagingDeploymentRecord(
      JSON.stringify({
        ...actual,
        deployment_urls: ["https://deadbeef.previews.indrax.uk"],
      }),
      sha
    )
  ).toThrow("valid unique staging")
})

it.each([
  { version: 2 },
  { worker_name: "indrax-dev" },
  { preview_name: "main" },
  { preview_urls: ["https://indrax.uk"] },
  { deployment_id: "id\nforged=true" },
  { deployment_urls: ["https://evil.test/develop.previews.indrax.uk"] },
  { deployment_urls: ["https://id-develop.previews.indrax.uk.evil.test"] },
  { deployment_urls: ["http://id-develop.previews.indrax.uk"] },
  { deployment_urls: ["https://token@id-develop.previews.indrax.uk"] },
  { deployment_urls: ["https://id-develop.previews.indrax.uk?token=value"] },
])("rejects mismatched or unsafe deployment metadata: %j", (replacement) => {
  expect(() => stagingDeploymentRecord(JSON.stringify({ ...entry, ...replacement }), sha)).toThrow()
})

it("rejects absent/ambiguous output or a shortened SHA", () => {
  expect(() => stagingDeploymentRecord("", sha)).toThrow()
  expect(() => stagingDeploymentRecord(JSON.stringify(entry), "abc123")).toThrow()
  expect(() =>
    stagingDeploymentRecord([entry, entry].map((value) => JSON.stringify(value)).join("\n"), sha)
  ).toThrow()
})
