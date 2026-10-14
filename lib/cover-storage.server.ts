import { getRequest, getRuntimeEnv, serverEnv } from "@/lib/runtime.server"
import { isAllowedMediaUrl } from "@/lib/utils/media"
import { usesLocalMedia } from "./local-media.server"
import { isLoopbackUrl, localMediaOrigin } from "./uploads/local-media"

/** The Worker binding grants access to one bucket; no S3 credentials are needed. */
export function getCoverStorageConfig() {
  const bucket = getRuntimeEnv().MEDIA_BUCKET as R2Bucket | undefined
  if (!bucket || typeof bucket.put !== "function") return null
  const publicUrl = serverEnv("MEDIA_ORIGIN") ?? process.env.MEDIA_ORIGIN
  if (serverEnv("NODE_ENV") === "development" && isLoopbackUrl(getRequest().url)) {
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
