import "server-only"

import { isAllowedMediaUrl } from "@/lib/utils/media"

/** Shared by the upload endpoint and authoring UI; credentials stay on the server. */
export function getCoverStorageConfig() {
  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  const bucket = process.env.R2_BUCKET
  const publicUrl = process.env.NEXT_PUBLIC_MEDIA_ORIGIN

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
