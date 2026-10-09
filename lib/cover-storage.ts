import { serverEnv } from "@/lib/runtime.server"
import { isAllowedMediaUrl } from "@/lib/utils/media"

/** Shared by the upload endpoint and authoring UI; credentials stay on the server. */
export function getCoverStorageConfig() {
  const accountId = serverEnv("R2_ACCOUNT_ID")
  const accessKeyId = serverEnv("R2_ACCESS_KEY_ID")
  const secretAccessKey = serverEnv("R2_SECRET_ACCESS_KEY")
  const bucket = serverEnv("R2_BUCKET")
  const publicUrl = serverEnv("NEXT_PUBLIC_MEDIA_ORIGIN") ?? process.env.NEXT_PUBLIC_MEDIA_ORIGIN

  if (
    !accountId?.trim() ||
    !accessKeyId?.trim() ||
    !secretAccessKey?.trim() ||
    !bucket?.trim() ||
    !isAllowedMediaUrl(publicUrl)
  ) {
    return null
  }

  return { accountId, accessKeyId, secretAccessKey, bucket, publicUrl }
}
