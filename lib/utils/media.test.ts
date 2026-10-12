import { afterEach, describe, expect, it, vi } from "vitest"

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
  vi.unstubAllEnvs()
})

describe("isAllowedMediaUrl", () => {
  it("restricts HTTPS local media to generated cover URLs too", () => {
    vi.stubEnv("NEXT_PUBLIC_MEDIA_ORIGIN", "https://localhost:5173/local-media")
    expect(
      isAllowedMediaUrl(
        "https://localhost:5173/local-media/covers/51dad294-2e29-40c4-9c1f-2df003c48e57.png"
      )
    ).toBe(true)
    expect(isAllowedMediaUrl("https://localhost:5173/anything.svg")).toBe(false)
    vi.stubEnv("DEV", false)
    expect(
      isAllowedMediaUrl(
        "https://localhost:5173/local-media/covers/51dad294-2e29-40c4-9c1f-2df003c48e57.png"
      )
    ).toBe(false)
  })
  it("refuses local cover paths in production builds", () => {
    vi.stubEnv("DEV", false)
    vi.stubEnv("NEXT_PUBLIC_MEDIA_ORIGIN", "http://localhost:5173/local-media")
    expect(isAllowedMediaUrl("/local-media/covers/51dad294-2e29-40c4-9c1f-2df003c48e57.png")).toBe(
      false
    )
  })
  it("only accepts generated cover URLs on the configured local origin", () => {
    vi.stubEnv("NEXT_PUBLIC_MEDIA_ORIGIN", "http://localhost:5173/local-media")
    const path = "http://localhost:5173/local-media/covers/51dad294-2e29-40c4-9c1f-2df003c48e57.png"
    expect(isAllowedMediaUrl(path)).toBe(true)
    for (const value of [
      path + "?redirect=evil",
      path + "#x",
      "/local.png",
      "/local-media/secret.txt",
      "/local-media/covers/../secret.png",
      "//evil.test" + path,
    ])
      expect(isAllowedMediaUrl(value), value).toBe(false)
  })
  it("refuses everything when no origin is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_MEDIA_ORIGIN", "")
    // The state of this deployment today: closed rather than open in
    // anticipation of uploads that do not exist yet.
    expect(isAllowedMediaUrl(`${ORIGIN}/covers/a.png`)).toBe(false)
  })

  it("accepts an https URL on the exact configured host", () => {
    vi.stubEnv("NEXT_PUBLIC_MEDIA_ORIGIN", ORIGIN)
    expect(isAllowedMediaUrl(`${ORIGIN}/covers/a.png`)).toBe(true)
  })

  it("refuses the suffix and prefix tricks", () => {
    vi.stubEnv("NEXT_PUBLIC_MEDIA_ORIGIN", ORIGIN)

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
    vi.stubEnv("NEXT_PUBLIC_MEDIA_ORIGIN", ORIGIN)
    // The host here is evil.test; everything before the @ is userinfo.
    expect(isAllowedMediaUrl("https://media.example.com@evil.test/a.png")).toBe(false)
  })

  it("rejects other ports and userinfo even on the allowed hostname", () => {
    vi.stubEnv("NEXT_PUBLIC_MEDIA_ORIGIN", ORIGIN)
    for (const value of [
      "https://media.example.com:8443/covers/a.png",
      "https://user:password@media.example.com/covers/a.png",
    ])
      expect(isAllowedMediaUrl(value)).toBe(false)
    expect(isAllowedMediaUrl("https://media.example.com:443/covers/a.png")).toBe(true)
  })

  it("refuses anything that is not https", () => {
    vi.stubEnv("NEXT_PUBLIC_MEDIA_ORIGIN", ORIGIN)

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
    vi.stubEnv("NEXT_PUBLIC_MEDIA_ORIGIN", ORIGIN)

    for (const url of [null, undefined, "", "not a url", "//protocol-relative/a.png"]) {
      expect(isAllowedMediaUrl(url), String(url)).toBe(false)
    }
  })

  it("refuses everything when the configured origin is itself unparseable", () => {
    vi.stubEnv("NEXT_PUBLIC_MEDIA_ORIGIN", "not a url")
    expect(isAllowedMediaUrl(`${ORIGIN}/a.png`)).toBe(false)
  })
})
