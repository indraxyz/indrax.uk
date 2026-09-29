import { afterEach, describe, expect, it } from "vitest"

import { isAllowedMediaUrl } from "./media"

/**
 * The only gate on cover images (threat T-6).
 *
 * Most of these are the shapes an allow-list gets wrong when it is written with
 * `startsWith` or `endsWith` instead of parsing the URL. They are cheap to
 * assert and each one is a real bypass somebody has shipped.
 */
const ORIGIN = "https://media.example.com"

afterEach(() => {
  delete process.env.NEXT_PUBLIC_MEDIA_ORIGIN
})

describe("isAllowedMediaUrl", () => {
  it("refuses everything when no origin is configured", () => {
    // The state of this deployment today: closed rather than open in
    // anticipation of uploads that do not exist yet.
    expect(isAllowedMediaUrl(`${ORIGIN}/covers/a.png`)).toBe(false)
  })

  it("accepts an https URL on the exact configured host", () => {
    process.env.NEXT_PUBLIC_MEDIA_ORIGIN = ORIGIN
    expect(isAllowedMediaUrl(`${ORIGIN}/covers/a.png`)).toBe(true)
  })

  it("refuses the suffix and prefix tricks", () => {
    process.env.NEXT_PUBLIC_MEDIA_ORIGIN = ORIGIN

    for (const url of [
      "https://media.example.com.evil.test/a.png",
      "https://evil.test/media.example.com/a.png",
      "https://notmedia.example.com/a.png",
      "https://media.example.com./a.png",
      "https://evil.test/?x=https://media.example.com/a.png",
    ]) {
      expect(isAllowedMediaUrl(url), url).toBe(false)
    }
  })

  it("refuses credentials-in-userinfo, which reads as the right host", () => {
    process.env.NEXT_PUBLIC_MEDIA_ORIGIN = ORIGIN
    // The host here is evil.test; everything before the @ is userinfo.
    expect(isAllowedMediaUrl("https://media.example.com@evil.test/a.png")).toBe(false)
  })

  it("refuses anything that is not https", () => {
    process.env.NEXT_PUBLIC_MEDIA_ORIGIN = ORIGIN

    for (const url of [
      "http://media.example.com/a.png",
      "javascript:alert(1)",
      "data:image/png;base64,iVBORw0KGgo=",
      "file:///etc/passwd",
    ]) {
      expect(isAllowedMediaUrl(url), url).toBe(false)
    }
  })

  it("refuses empty and unparseable input without throwing", () => {
    process.env.NEXT_PUBLIC_MEDIA_ORIGIN = ORIGIN

    for (const url of [null, undefined, "", "not a url", "//protocol-relative/a.png"]) {
      expect(isAllowedMediaUrl(url), String(url)).toBe(false)
    }
  })

  it("refuses everything when the configured origin is itself unparseable", () => {
    process.env.NEXT_PUBLIC_MEDIA_ORIGIN = "not a url"
    expect(isAllowedMediaUrl(`${ORIGIN}/a.png`)).toBe(false)
  })
})
