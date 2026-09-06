import { AwsClient } from "aws4fetch"
import { NextResponse } from "next/server"
import { z } from "zod"

import { requireAuthor } from "@/lib/auth-guard"

export const dynamic = "force-dynamic"

/**
 * What may be uploaded, enforced here rather than in the browser.
 *
 * A client-side check is a courtesy to the author; it is not a control, because
 * the request that matters is the one that skips the form entirely. Both the type
 * and the size are decided server-side before any URL is minted (threat T-5).
 */
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const
const MAX_BYTES = 5 * 1024 * 1024

/**
 * How long a minted URL is good for.
 *
 * Short, because the only thing that needs to happen inside the window is one
 * upload that the author has already initiated. A long-lived presigned URL is a
 * credential that has escaped, and a five-minute one is barely worth stealing.
 */
const URL_TTL_SECONDS = 300

const requestSchema = z.object({
  contentType: z.enum(ALLOWED_TYPES),
  // Advisory: the browser reports it, and it is checked against the cap before a
  // URL exists. The bucket's own limits are the backstop for a client that lies.
  size: z.number().int().positive().max(MAX_BYTES),
  fileName: z.string().min(1).max(200),
})

const EXTENSIONS: Record<(typeof ALLOWED_TYPES)[number], string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
}

function config() {
  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  const bucket = process.env.R2_BUCKET
  const publicUrl = process.env.NEXT_PUBLIC_MEDIA_ORIGIN

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicUrl) return null

  return { accountId, accessKeyId, secretAccessKey, bucket, publicUrl }
}

/**
 * Mints a short-lived, single-object URL the browser uploads straight to.
 *
 * The file never passes through this application, which is the point: a Worker
 * has neither the memory nor the time budget to proxy a five-megabyte image, and
 * routing one through it would only add a place for it to go wrong.
 *
 * `aws4fetch` rather than the AWS SDK. It is a SigV4 signer and nothing else,
 * which is all R2 needs, and it is a few kilobytes against the SDK's megabytes -
 * which matters on a runtime with a bundle-size limit.
 */
export async function POST(request: Request) {
  // Before anything else, and independently of `proxy.ts`: this is a route
  // handler, so nothing about routing has authorised the caller (threat T-3).
  await requireAuthor()

  const settings = config()
  if (!settings) {
    return NextResponse.json(
      { error: "No media storage is configured for this deployment." },
      { status: 501 }
    )
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: "That file cannot be uploaded.", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { contentType, fileName } = parsed.data

  // The key is generated, never taken from the client. A caller-supplied name is
  // how an upload ends up overwriting something else, or escaping its prefix.
  const key = `covers/${crypto.randomUUID()}.${EXTENSIONS[contentType]}`

  const client = new AwsClient({
    accessKeyId: settings.accessKeyId,
    secretAccessKey: settings.secretAccessKey,
    service: "s3",
    region: "auto",
  })

  const endpoint = `https://${settings.accountId}.r2.cloudflarestorage.com/${settings.bucket}/${key}`

  const signed = await client.sign(
    new Request(`${endpoint}?X-Amz-Expires=${URL_TTL_SECONDS}`, {
      method: "PUT",
      headers: { "content-type": contentType },
    }),
    { aws: { signQuery: true } }
  )

  return NextResponse.json({
    // Scoped to this one key and this one content type, and expiring in minutes.
    uploadUrl: signed.url,
    contentType,
    // Where it will be readable once uploaded. Must match NEXT_PUBLIC_MEDIA_ORIGIN
    // or `isAllowedMediaUrl` will refuse to render it - which is the same check
    // twice on purpose (threat T-6).
    publicUrl: new URL(`/${key}`, settings.publicUrl).toString(),
    // So the author is told the same thing the server would enforce.
    originalName: fileName,
  })
}
