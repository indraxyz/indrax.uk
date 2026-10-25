import { getRequest, getRuntimeEnv, serverEnv } from "@/lib/runtime.server"
import { isAllowedMediaUrl } from "@/lib/utils/media"
import { usesLocalMedia } from "./local-media.server"
import { isLocalDevelopmentUrl, isLocalMediaUrl, localMediaOrigin } from "./uploads/local-media"

import { isGeneratedCoverKey } from "./uploads/policy"

/** Only server-generated covers in this deployment's bucket may be deleted. */
export function managedCoverKey(value: string, publicUrl: string): string | null {
  try {
    const base = new URL(`${publicUrl.replace(/\/$/, "")}/`)
    const url = new URL(value)
    if (url.username || url.password || url.search || url.hash) return null
    const local = localMediaOrigin(base.href)
    if (local ? !isLocalMediaUrl(value) : url.origin !== base.origin) return null
    if (!url.pathname.startsWith(base.pathname)) return null
    const key = url.pathname.slice(base.pathname.length)
    return isGeneratedCoverKey(key) ? key : null
  } catch {
    return null
  }
}

/** The Worker binding grants access to one bucket; no S3 credentials are needed. */
export function getCoverStorageConfig() {
  const bucket = getRuntimeEnv().MEDIA_BUCKET as R2Bucket | undefined
  if (!bucket || typeof bucket.put !== "function") return null
  const publicUrl = serverEnv("MEDIA_ORIGIN") ?? process.env.MEDIA_ORIGIN
  if (serverEnv("NODE_ENV") === "development" && isLocalDevelopmentUrl(getRequest().url)) {
    if (!usesLocalMedia()) return null
    const local = localMediaOrigin(publicUrl)
    const rendered = localMediaOrigin(process.env.MEDIA_ORIGIN)
    if (!local || local.origin !== rendered?.origin) return null
    return { bucket, publicUrl: local.href.replace(/\/$/, "") }
  }

  if (!isAllowedMediaUrl(publicUrl)) {
    return null
  }

  return { bucket, publicUrl }
}
