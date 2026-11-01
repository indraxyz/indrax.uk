import { afterEach, describe, expect, it, vi } from "vitest"

import { contentImageUrl } from "./image-url"

afterEach(() => vi.unstubAllEnvs())

describe("contentImageUrl", () => {
  it("accepts authored HTTPS images outside the configured cover origin", () => {
    vi.stubEnv("MEDIA_ORIGIN", "https://media.indrax.uk")
    expect(contentImageUrl(" https://images.example.com/a.png ")).toBe(
      "https://images.example.com/a.png"
    )
  })

  it.each([
    "javascript:alert(1)",
    "data:image/png;base64,aGVsbG8=",
    "http://images.example.com/a.png",
    "https://user:secret@images.example.com/a.png",
    "//images.example.com/a.png",
    "/private/image.png",
    "",
  ])("refuses an unsupported image source: %s", (value) => {
    expect(contentImageUrl(value)).toBeNull()
  })

  it("normalizes local generated images to the current development server", () => {
    vi.stubEnv("MEDIA_ORIGIN", "http://localhost:5174/local-media")
    const path = "/local-media/content/51dad294-2e29-40c4-9c1f-2df003c48e57.png"
    expect(contentImageUrl(`http://localhost:5173${path}`)).toBe(`http://localhost:5174${path}`)
    vi.stubEnv("DEV", false)
    expect(contentImageUrl(`http://localhost:5173${path}`)).toBeNull()
  })
})
