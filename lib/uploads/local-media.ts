import { isGeneratedCoverKey } from "./policy.ts"

/** Same-origin URLs for isolated local R2 objects, never arbitrary relative URLs. */
export const LOCAL_MEDIA_PREFIX = "/local-media/"

export function isLocalMediaPath(value: string): boolean {
  return (
    value.startsWith(LOCAL_MEDIA_PREFIX) &&
    isGeneratedCoverKey(value.slice(LOCAL_MEDIA_PREFIX.length))
  )
}

export function localMediaOrigin(value: string | undefined): URL | null {
  try {
    const url = new URL(value ?? "")
    return ["http:", "https:"].includes(url.protocol) &&
      isLocalDevelopmentUrl(url.href) &&
      [LOCAL_MEDIA_PREFIX, LOCAL_MEDIA_PREFIX.slice(0, -1)].includes(url.pathname) &&
      !url.search &&
      !url.hash &&
      !url.username &&
      !url.password
      ? url
      : null
  } catch {
    return null
  }
}

export function isLocalMediaUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return Boolean(
      localMediaOrigin(new URL(LOCAL_MEDIA_PREFIX, url.origin).href) &&
      isLocalMediaPath(url.pathname) &&
      !url.search &&
      !url.hash &&
      !url.username &&
      !url.password
    )
  } catch {
    return false
  }
}

/** Vite removes local cover acceptance from deployed public/admin builds. */
export function allowsLocalMediaUrl(value: string): boolean {
  if (import.meta.env?.DEV !== true || !isLocalMediaUrl(value)) return false
  const origin = localMediaOrigin(process.env.MEDIA_ORIGIN)
  return Boolean(origin && new URL(value).origin === origin.origin)
}

/** Stored development covers survive a change of the local server's host/port. */
export function currentLocalMediaUrl(value: string): string {
  if (import.meta.env?.DEV !== true || !isLocalMediaUrl(value)) return value
  const origin = localMediaOrigin(process.env.MEDIA_ORIGIN)
  return origin ? new URL(new URL(value).pathname, origin.origin).href : value
}

function isLoopbackUrl(value: string): boolean {
  const url = new URL(value)
  return ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
}

/**
 * Loopback, or a name reserved for local use that never resolves on the public
 * internet (RFC 6761 `.test` and `.localhost`), such as `https://indrax.uk.test`
 * behind a local HTTPS proxy. Local media still requires development mode and an
 * exact match with the configured MEDIA_ORIGIN.
 */
export function isLocalDevelopmentUrl(value: string): boolean {
  const { hostname } = new URL(value)
  return isLoopbackUrl(value) || /^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:test|localhost)$/.test(hostname)
}
