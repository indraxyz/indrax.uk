/**
 * The single origin cover images may be served from, or null when none is
 * configured.
 *
 * This is the only gate on cover images, so it is the only place that decides
 * which origin is trusted. With no configured origin nothing remote is loaded.
 * Builds use the environment's R2 media origin by default (threat T-6).
 */
import { allowsLocalMediaUrl, localMediaOrigin } from "../uploads/local-media"

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
 * Exact origin match over `https` only. A prefix or `endsWith` check here would
 * accept `indrax-media.example.com.evil.test`, which is the usual way an
 * allow-list turns into a redirect to somebody else's server.
 */
export function isAllowedMediaUrl(value: string | null | undefined): value is string {
  if (!value) return false
  // This narrow same-origin path only serves simulated R2 covers in development.
  // Production never generates these URLs and its local-media route returns 404.
  if (localMediaOrigin(process.env.NEXT_PUBLIC_MEDIA_ORIGIN)) return allowsLocalMediaUrl(value)

  const origin = mediaOrigin()
  if (!origin) return false

  try {
    const url = new URL(value)
    return (
      origin.protocol === "https:" &&
      url.protocol === "https:" &&
      url.origin === origin.origin &&
      !url.username &&
      !url.password
    )
  } catch {
    return false
  }
}
