export const YOUTUBE_EMBED_ORIGIN = "https://www.youtube-nocookie.com"
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/
const MAX_START_SECONDS = 86_400

/** Authored frame widths are bounded integers; height is always the 16:9 ratio. */
export function videoWidth(value: unknown): number {
  const width = typeof value === "string" && /^\d{1,4}$/.test(value) ? Number(value) : value
  return typeof width === "number" && Number.isInteger(width) && width >= 32 && width <= 3840
    ? width
    : 640
}

/** A bounded playback offset; ignore provider tracking/player configuration. */
function startSeconds(value: string | null): number | null {
  if (value === null || value === "") return 0
  if (/^\d+$/.test(value)) {
    const seconds = Number(value)
    return Number.isSafeInteger(seconds) && seconds <= MAX_START_SECONDS ? seconds : null
  }
  const parts = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(value)
  if (!parts || !parts[0]) return null
  const seconds = Number(parts[1] ?? 0) * 3600 + Number(parts[2] ?? 0) * 60 + Number(parts[3] ?? 0)
  return Number.isSafeInteger(seconds) && seconds <= MAX_START_SECONDS ? seconds : null
}

/** Normalize only explicit HTTPS YouTube video URLs to the privacy embed host. */
export function normalizeYouTubeUrl(value: string): string | null {
  try {
    // URL() normalizes control characters/backslashes; reject those before parsing.
    if (
      Array.from(value.trim()).some(
        (character) => character <= " " || character === "\u007f" || character === "\\"
      )
    )
      return null
    const url = new URL(value.trim())
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null
    let id: string | null = null
    if (url.hostname === "youtu.be") {
      id = /^\/([A-Za-z0-9_-]{11})\/?$/.exec(url.pathname)?.[1] ?? null
    } else if (["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname)) {
      id =
        url.pathname === "/watch"
          ? url.searchParams.get("v")
          : (/^\/(?:shorts|embed)\/([A-Za-z0-9_-]{11})\/?$/.exec(url.pathname)?.[1] ?? null)
    } else if (url.hostname === "www.youtube-nocookie.com") {
      id = /^\/embed\/([A-Za-z0-9_-]{11})$/.exec(url.pathname)?.[1] ?? null
    }
    if (!id || id.length !== 11 || !VIDEO_ID.test(id)) return null
    const seconds = startSeconds(url.searchParams.get("start") ?? url.searchParams.get("t"))
    if (seconds === null) return null
    return `${YOUTUBE_EMBED_ORIGIN}/embed/${id}${seconds ? `?start=${seconds}` : ""}`
  } catch {
    return null
  }
}

/** Rendered iframes must already use the exact privacy host and embed path. */
export function canonicalYouTubeEmbed(value: string): string | null {
  try {
    const url = new URL(value)
    return url.origin === YOUTUBE_EMBED_ORIGIN && /^\/embed\/[A-Za-z0-9_-]{11}$/.test(url.pathname)
      ? normalizeYouTubeUrl(value)
      : null
  } catch {
    return null
  }
}
