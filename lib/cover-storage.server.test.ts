import { afterEach, expect, it, vi } from "vitest"
import { getCoverStorageConfig, managedCoverKey } from "./cover-storage.server"
import { runWithRequest } from "./runtime.server"

afterEach(() => vi.unstubAllEnvs())

function config(bucket: unknown, origin = "https://media.example.com") {
  vi.stubEnv("MEDIA_ORIGIN", origin)
  return runWithRequest(
    new Request("https://example.com"),
    { MEDIA_BUCKET: bucket, MEDIA_ORIGIN: origin },
    undefined,
    getCoverStorageConfig
  )
}

it("uses the environment's binding without S3 credentials", () => {
  const bucket = { put: vi.fn() }
  expect(config(bucket)).toEqual({ bucket, publicUrl: "https://media.example.com" })
})

it.each([undefined, null, {}, "bucket-name"])(
  "refuses missing or invalid binding: %j",
  (bucket) => {
    expect(config(bucket)).toBeNull()
  }
)

it.each([
  "",
  "not a url",
  "http://media.example.com",
  "//media.example.com",
  "javascript:alert(1)",
])("refuses an unavailable or unsafe media origin: %s", (origin) => {
  expect(config({ put: vi.fn() }, origin)).toBeNull()
})

it("requires the runtime media origin to match the renderer's allowlist", () => {
  vi.stubEnv("MEDIA_ORIGIN", "https://media.example.com")
  const result = runWithRequest(
    new Request("https://example.com"),
    {
      MEDIA_BUCKET: { put: vi.fn() },
      MEDIA_ORIGIN: "https://other.example.com",
    },
    undefined,
    getCoverStorageConfig
  )
  expect(result).toBeNull()
})

const key = "covers/550e8400-e29b-41d4-a716-446655440000.png"
it("resolves only managed keys beneath the configured public origin and prefix", () => {
  expect(managedCoverKey(`https://media.example.com/${key}`, "https://media.example.com")).toBe(key)
  expect(
    managedCoverKey(`https://media.example.com/assets/${key}`, "https://media.example.com/assets")
  ).toBe(key)
})

it("resolves a persisted local cover after changing local host/port", () => {
  expect(
    managedCoverKey(`http://localhost:5173/local-media/${key}`, "http://127.0.0.1:5174/local-media")
  ).toBe(key)
})

it.each([
  `https://other.example.com/${key}`,
  `https://media.example.com.evil.invalid/${key}`,
  `https://user:password@media.example.com/${key}`,
  `https://media.example.com/${key}?delete=true`,
  `https://media.example.com/${key}#image`,
  "https://media.example.com/covers/arbitrary.png",
  "https://media.example.com/avatars/550e8400-e29b-41d4-a716-446655440000.png",
  "https://media.example.com/covers/550e8400-e29b-41d4-a716-446655440000.svg",
  "/covers/550e8400-e29b-41d4-a716-446655440000.png",
  "not a URL",
])("does not map an external or non-managed cover to a bucket key: %s", (url) => {
  expect(managedCoverKey(url, "https://media.example.com")).toBeNull()
})

it("never maps local URLs to a production bucket or production URLs to a local bucket", () => {
  expect(
    managedCoverKey(`http://localhost:5173/local-media/${key}`, "https://media.example.com")
  ).toBeNull()
  expect(
    managedCoverKey(`https://media.example.com/${key}`, "http://localhost:5174/local-media")
  ).toBeNull()
})
