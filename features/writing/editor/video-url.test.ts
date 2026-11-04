import { describe, expect, it } from "vitest"

import { canonicalYouTubeEmbed, normalizeYouTubeUrl } from "./video-url"

const id = "dQw4w9WgXcQ"
const canonical = `https://www.youtube-nocookie.com/embed/${id}`

describe("YouTube video URLs", () => {
  it.each([
    `https://www.youtube.com/watch?v=${id}`,
    `https://youtube.com/watch?v=${id}&si=tracking&autoplay=1&enablejsapi=1`,
    `https://m.youtube.com/watch?v=${id}`,
    `https://youtu.be/${id}?si=tracking`,
    `https://www.youtube.com/shorts/${id}`,
    `https://www.youtube.com/embed/${id}`,
    canonical,
  ])("normalizes an approved video URL without provider options: %s", (url) => {
    expect(normalizeYouTubeUrl(url)).toBe(canonical)
  })

  it.each([
    [`https://youtu.be/${id}?t=90`, 90],
    [`https://www.youtube.com/watch?v=${id}&t=1h2m3s`, 3723],
    [`${canonical}?start=120&autoplay=1`, 120],
    [`${canonical}?start=86400`, 86400],
  ] as const)("retains a bounded playback offset: %s", (url, seconds) => {
    expect(normalizeYouTubeUrl(url)).toBe(`${canonical}?start=${seconds}`)
  })

  it.each([
    "",
    id,
    "not a URL",
    `http://www.youtube.com/watch?v=${id}`,
    `//www.youtube.com/embed/${id}`,
    `https://evil.test/watch?v=${id}`,
    `https://www.youtube.com.evil.test/watch?v=${id}`,
    `https://www.youtube.com@evil.test/watch?v=${id}`,
    `https://user:password@www.youtube.com/watch?v=${id}`,
    `https://www.youtube.com:8443/watch?v=${id}`,
    `https://www.youtube.com./watch?v=${id}`,
    `https://www.youtube-nocookie.com.evil.test/embed/${id}`,
    `https://www.youtube.com/playlist?list=${id}`,
    `https://www.youtube.com/watch?v=${id}extra`,
    `https://www.youtube.com/watch?v=${id}%0a`,
    `https://www.youtube.com/watch?v=<script>`,
    `https://www.youtube.com/embed/${id}/more`,
    `https://www.youtube.com/embed/%64Qw4w9WgXcQ`,
    `https://youtu.be/${id}/more`,
    `https://www.youtube.com/watch?v=${id}&t=-1`,
    `https://www.youtube.com/watch?v=${id}&t=86401`,
    `https://www.youtube.com/watch?v=${id}&t=Infinity`,
    `https://www.youtube.com/watch?v=${id}&start=1.5`,
    `https://www.youtube.com/watch?v=${id}&t=1hgarbage`,
    `https://www.you\ntube.com/watch?v=${id}`,
    `https:\\www.youtube.com\\embed\\${id}`,
    `javascript:alert(1)`,
    `data:text/html,<iframe>`,
  ])("rejects malformed and unapproved URLs: %s", (url) => {
    expect(normalizeYouTubeUrl(url)).toBeNull()
  })

  it("requires the privacy host at the final renderer boundary", () => {
    expect(canonicalYouTubeEmbed(canonical)).toBe(canonical)
    expect(canonicalYouTubeEmbed(`${canonical}?autoplay=1&start=10&origin=https://evil.test`)).toBe(
      `${canonical}?start=10`
    )
    expect(canonicalYouTubeEmbed(`https://www.youtube.com/embed/${id}`)).toBeNull()
    expect(canonicalYouTubeEmbed(`https://www.youtube-nocookie.com/watch?v=${id}`)).toBeNull()
    expect(canonicalYouTubeEmbed(`https://user@www.youtube-nocookie.com/embed/${id}`)).toBeNull()
  })
})
