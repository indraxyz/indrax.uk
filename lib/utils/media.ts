/**
 * The single origin cover images may be served from, or null when none is
 * configured.
 *
 * This is the only gate on cover images, so it is the only place that decides
 * which host is trusted. Unset is the safe default and the current state: with no
 * configured origin nothing remote is loaded at all, which keeps the image host
 * closed rather than open in anticipation of uploads that do not exist yet
 * (threat T-6). Phase 3 sets it to the R2 public origin.
 */
function mediaOrigin(): URL | null {
  const value = process.env.NEXT_PUBLIC_MEDIA_ORIGIN
  if (!value) return null

  try {
    return new URL(value)
  } catch {
    return null
  }
}

/**
 * Whether a stored cover URL may be rendered.
 *
 * Exact host match over `https` only. A prefix or `endsWith` check here would
 * accept `indrax-media.example.com.evil.test`, which is the usual way an
 * allow-list turns into a redirect to somebody else's server.
 */
export function isAllowedMediaUrl(value: string | null | undefined): value is string {
  if (!value) return false

  const origin = mediaOrigin()
  if (!origin) return false

  try {
    const url = new URL(value)
    return url.protocol === "https:" && url.hostname === origin.hostname
  } catch {
    return false
  }
}
