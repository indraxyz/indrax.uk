import { expect, it } from "vitest"
import { assertTargetOrigin, buildTarget, getDeploymentTarget } from "./deployment-targets.mjs"

it("names one parent Worker for production and staging and keeps legacy dev distinct", () => {
  expect(getDeploymentTarget("production").workerName).toBe("indrax")
  expect(getDeploymentTarget("staging")).toMatchObject({
    workerName: "indrax",
    previewName: "develop",
    siteUrl: "https://develop.previews.indrax.uk",
  })
  expect(getDeploymentTarget("dev").workerName).toBe("indrax-dev")
})

it.each(["https://indrax.uk", "https://develop.previews.indrax.uk/", "https://evil.test"])(
  "refuses a staging origin other than its exact stable URL: %s",
  (origin) => expect(() => assertTargetOrigin("staging", origin)).toThrow("origin")
)

it("rejects unknown targets and conflicting inherited Wrangler environments", () => {
  expect(() => getDeploymentTarget("preview")).toThrow("Choose")
  expect(() => buildTarget({ DEPLOYMENT_TARGET: "staging", CLOUDFLARE_ENV: "dev" })).toThrow(
    "conflicts"
  )
  expect(buildTarget({})).toBeUndefined()
  expect(buildTarget({ DEPLOYMENT_TARGET: "production" })).toBe(getDeploymentTarget("production"))
})
