import { expect, it } from "vitest"
import { assertTargetOrigin, buildTarget, getDeploymentTarget } from "./deployment-targets.mjs"

it("names one parent Worker for production and staging without a legacy dev target", () => {
  expect(getDeploymentTarget("production").workerName).toBe("indrax")
  expect(getDeploymentTarget("staging")).toMatchObject({
    workerName: "indrax",
    previewName: "develop",
    siteUrl: "https://develop.previews.indrax.uk",
  })
  expect(() => getDeploymentTarget("dev")).toThrow("Choose production or staging")
})

it.each(["https://indrax.uk", "https://develop.previews.indrax.uk/", "https://evil.test"])(
  "refuses a staging origin other than its exact stable URL: %s",
  (origin) => expect(() => assertTargetOrigin("staging", origin)).toThrow("origin")
)

it("rejects unknown targets and conflicting inherited Wrangler environments", () => {
  expect(() => getDeploymentTarget("preview")).toThrow("Choose")
  expect(() => buildTarget({ DEPLOYMENT_TARGET: "staging", CLOUDFLARE_ENV: "dev" })).toThrow(
    "unsupported"
  )
  expect(buildTarget({})).toBeUndefined()
  expect(buildTarget({ DEPLOYMENT_TARGET: "production" })).toBe(getDeploymentTarget("production"))
})

it("rejects a named Wrangler environment even for local builds", () => {
  expect(() => buildTarget({ CLOUDFLARE_ENV: "dev" })).toThrow("unsupported")
  expect(() => buildTarget({ DEPLOYMENT_TARGET: "dev" })).toThrow("Choose")
})
