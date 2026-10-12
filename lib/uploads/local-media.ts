/** Same-origin URLs for isolated local R2 objects, never arbitrary relative URLs. */
export const LOCAL_MEDIA_PREFIX = "/local-media/"
const COVER_PATH =
  /^\/local-media\/covers\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp|avif)$/

export function isLocalMediaPath(value: string): boolean {
  return COVER_PATH.test(value) && !/[\r\n]/.test(value)
}

export function localMediaOrigin(value: string | undefined): URL | null {
  try {
    const url = new URL(value ?? "")
    return ["http:", "https:"].includes(url.protocol) &&
      isLoopbackUrl(url.href) &&
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
  const origin = localMediaOrigin(process.env.NEXT_PUBLIC_MEDIA_ORIGIN)
  return Boolean(origin && new URL(value).origin === origin.origin)
}

export function isLoopbackUrl(value: string): boolean {
  const url = new URL(value)
  return ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
}
