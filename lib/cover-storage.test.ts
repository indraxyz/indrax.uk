import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { getCoverStorageConfig } from "./cover-storage"

const configured = {
  R2_ACCOUNT_ID: "account-id",
  R2_ACCESS_KEY_ID: "access-key",
  R2_SECRET_ACCESS_KEY: "secret-key",
  R2_BUCKET: "covers",
  NEXT_PUBLIC_MEDIA_ORIGIN: "https://media.example.com",
}

beforeEach(() => {
  for (const [key, value] of Object.entries(configured)) vi.stubEnv(key, value)
})

afterEach(() => vi.unstubAllEnvs())

describe("getCoverStorageConfig", () => {
  it("returns the signing configuration only when storage and media origin are available", () => {
    expect(getCoverStorageConfig()).toEqual({
      accountId: configured.R2_ACCOUNT_ID,
      accessKeyId: configured.R2_ACCESS_KEY_ID,
      secretAccessKey: configured.R2_SECRET_ACCESS_KEY,
      bucket: configured.R2_BUCKET,
      publicUrl: configured.NEXT_PUBLIC_MEDIA_ORIGIN,
    })
  })

  it.each(Object.keys(configured))("disables cover uploads when %s is missing", (key) => {
    vi.stubEnv(key, undefined)
    expect(getCoverStorageConfig()).toBeNull()
  })

  it.each(Object.keys(configured))("disables cover uploads when %s is blank", (key) => {
    vi.stubEnv(key, "   ")
    expect(getCoverStorageConfig()).toBeNull()
  })

  it.each(["not a url", "http://media.example.com", "//media.example.com", "javascript:alert(1)"])(
    "disables cover uploads with a media origin the renderer cannot use: %s",
    (origin) => {
      vi.stubEnv("NEXT_PUBLIC_MEDIA_ORIGIN", origin)
      expect(getCoverStorageConfig()).toBeNull()
    }
  )
})
