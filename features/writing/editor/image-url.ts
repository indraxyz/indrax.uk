import { mediaUrl } from "@/lib/utils/media"

/** Match authored article media: HTTPS, or generated local media during development. */
export function contentImageUrl(value: string): string | null {
  try {
    const url = new URL(value.trim())
    if (url.username || url.password) return null
    const local = mediaUrl(url.href)
    return local ?? (url.protocol === "https:" ? url.href : null)
  } catch {
    return null
  }
}
