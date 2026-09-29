import { AwsClient } from "aws4fetch"
import { NextResponse } from "next/server"
import { z } from "zod"

import { requireAuthor } from "@/lib/auth-guard"

export const dynamic = "force-dynamic"

/**
 * What may be uploaded.
 *
 * These decide whether a URL is minted at all, which is a real gate: a caller who
 * asks for `text/html` or fifty megabytes gets nothing. What they do **not** do is
 * constrain the upload itself. `aws4fetch` treats `content-type` and
 * `content-length` as unsignable, so a presigned URL authorises any body of any
 * length to that one key - the signature covers the method and the object, and
 * nothing else.
 *
 * So the honest description of the control is: only an authenticated author can
 * obtain a URL, it dies in five minutes, and it can only ever write one generated
 * key. Enforcing the size and type of what actually lands is R2's job, via a
 * bucket policy - and until that exists this is the gap in T-5, stated rather than
 * papered over.
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
  // The browser reports this and it is checked before a URL exists. A client that
  // lies gets a URL anyway - see the note above - so this bounds the honest case,
  // not the hostile one.
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
  //
  // Answered as a 401 rather than allowed to throw, so an unauthenticated caller
  // gets the same shape of response as every other refusal here instead of a 500.
  try {
    await requireAuthor()
  } catch {
    return NextResponse.json({ error: "Not authorised." }, { status: 401 })
  }

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
    // Scoped to this one key and this one method, and expiring in minutes.
    uploadUrl: signed.url,
    contentType,
    // Where it will be readable once uploaded. Must match NEXT_PUBLIC_MEDIA_ORIGIN
    // or `isAllowedMediaUrl` will refuse to render it - which is the same check
    // twice on purpose (threat T-6).
    publicUrl: new URL(`/${key}`, settings.publicUrl).toString(),
    // Echoed back for display only. The key above is generated; nothing the client
    // sent is used to build it.
    originalName: fileName,
  })
}
