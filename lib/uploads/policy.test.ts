import { expect, it } from "vitest"
import { IMAGE_FORMATS } from "./file-signature"
import { describeTypes, getUploadPolicy, UPLOAD_POLICIES } from "./policy"

it("resolves only declared purposes", () => {
  expect(getUploadPolicy("cover")).toBe(UPLOAD_POLICIES.cover)
  for (const purpose of [null, "", "avatar", "toString", "__proto__", "constructor"])
    expect(getUploadPolicy(purpose)).toBeNull()
})

it("keeps every policy to scriptless image formats with a bounded size and a plain prefix", () => {
  for (const policy of Object.values(UPLOAD_POLICIES)) {
    expect(policy.types.length).toBeGreaterThan(0)
    for (const type of policy.types) expect(Object.keys(IMAGE_FORMATS)).toContain(type)
    expect(policy.types).not.toContain("image/svg+xml")
    expect(policy.maxBytes).toBeGreaterThan(0)
    expect(policy.maxBytes).toBeLessThanOrEqual(10 * 1024 * 1024)
    expect(policy.prefix).toMatch(/^[a-z0-9-]+$/)
  }
})

it("lists accepted formats for messages", () => {
  expect(describeTypes(UPLOAD_POLICIES.cover)).toBe("JPEG, PNG, WebP or AVIF")
  expect(describeTypes({ prefix: "x", maxBytes: 1, types: ["image/png"] })).toBe("PNG")
})
