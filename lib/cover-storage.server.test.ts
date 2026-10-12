import { afterEach, expect, it, vi } from "vitest"
import { getCoverStorageConfig } from "./cover-storage.server"
import { runWithRequest } from "./runtime.server"

afterEach(() => vi.unstubAllEnvs())

function config(bucket: unknown, origin = "https://media.example.com") {
  vi.stubEnv("NEXT_PUBLIC_MEDIA_ORIGIN", origin)
  return runWithRequest(
    new Request("https://example.com"),
    { MEDIA_BUCKET: bucket, NEXT_PUBLIC_MEDIA_ORIGIN: origin },
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
  vi.stubEnv("NEXT_PUBLIC_MEDIA_ORIGIN", "https://media.example.com")
  const result = runWithRequest(
    new Request("https://example.com"),
    {
      MEDIA_BUCKET: { put: vi.fn() },
      NEXT_PUBLIC_MEDIA_ORIGIN: "https://other.example.com",
    },
    undefined,
    getCoverStorageConfig
  )
  expect(result).toBeNull()
})
