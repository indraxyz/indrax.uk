import { AwsClient } from "aws4fetch"
import {
  assertSameOrigin,
  discardBody,
  mediaTypeOf,
  readBoundedBody,
  RequestError,
} from "./request-body.server"
import { detectImageType, IMAGE_FORMATS, SIGNATURE_BYTES } from "./uploads/file-signature"
import { describeTypes, getUploadPolicy } from "./uploads/policy"

import { requireAuthor } from "@/lib/auth-guard.server"
import { getCoverStorageConfig } from "@/lib/cover-storage.server"

type StorageSettings = NonNullable<ReturnType<typeof getCoverStorageConfig>>

/**
 * The one upload route. `?purpose=` picks a policy from `lib/uploads/policy.ts`.
 *
 * The file passes through the Worker on purpose. R2 has no rule that caps an
 * object's size, and a presigned PUT cannot pin the body the browser sends - so
 * a URL handed to the browser authorised any body, of any length, at that key.
 * Here every byte is checked before anything is stored (threat T-5):
 *
 * 1. an author session, then a same-origin request (T-3, T-9);
 * 2. a known purpose, and a declared type that purpose allows;
 * 3. the body, bounded while streaming - nothing past `maxBytes` is held;
 * 4. the bytes themselves, which must be the format the type declared;
 * 5. a key the server generates, under the purpose's prefix.
 *
 * Images are capped at a few megabytes, well inside a Worker's memory, and the
 * write to R2 is wall time, not CPU time.
 */
export async function POST(request: Request) {
  const response = await handleUpload(request)
  // Every refusal can arrive before the file has finished sending; drain what is
  // left so the client sees the status, not a dropped connection.
  if (!response.ok) await discardBody(request, DISCARD_LIMIT_BYTES)
  return response
}

/**
 * How much of a refused upload is drained so its status arrives cleanly.
 *
 * Comfortably above any policy cap, so an honest file that is a little too large
 * gets a readable 413. Anything bigger is cut off, and the edge rate limit
 * bounds how often anyone can try.
 */
const DISCARD_LIMIT_BYTES = 16 * 1024 * 1024

async function handleUpload(request: Request): Promise<Response> {
  // Answered as a 401 rather than allowed to throw, so an unauthenticated caller
  // gets the same shape of response as every other refusal here.
  try {
    await requireAuthor(request.headers)
  } catch {
    return Response.json({ error: "Not authorised." }, { status: 401 })
  }

  try {
    assertSameOrigin(request)
    const policy = getUploadPolicy(new URL(request.url).searchParams.get("purpose"))
    if (!policy) throw new RequestError(400, "Unknown upload purpose.")

    const declared = mediaTypeOf(request)
    const type = policy.types.find((allowed) => allowed === declared)
    if (!type) throw new RequestError(415, `Images only: ${describeTypes(policy)}.`)

    const body = await readBoundedBody(request, policy.maxBytes)
    if (body.byteLength === 0) throw new RequestError(400, "The file is empty.")
    if (detectImageType(body.subarray(0, SIGNATURE_BYTES)) !== type)
      throw new RequestError(415, "That file is not the image it claims to be.")

    // Checked last, so a deployment without storage still refuses bad files the
    // same way, and its validation can be tested without credentials.
    const settings = getCoverStorageConfig()
    if (!settings)
      return Response.json(
        { error: "No media storage is configured for this deployment." },
        { status: 501 }
      )

    // Generated, never taken from the client. A caller-supplied name is how an
    // upload ends up overwriting something else, or escaping its prefix.
    const key = `${policy.prefix}/${crypto.randomUUID()}.${IMAGE_FORMATS[type].extension}`
    if (!(await putObject(settings, key, body, type)))
      return Response.json({ error: "Storage refused the upload." }, { status: 502 })

    return Response.json(
      {
        // Must match NEXT_PUBLIC_MEDIA_ORIGIN or `isAllowedMediaUrl` will refuse to
        // render it - the same check twice on purpose (threat T-6).
        publicUrl: new URL(`/${key}`, settings.publicUrl).toString(),
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof RequestError)
      return Response.json({ error: error.message }, { status: error.status })
    throw error
  }
}

/**
 * Writes one verified object to R2 over its S3 API.
 *
 * `aws4fetch` rather than the AWS SDK: it is a SigV4 signer and nothing else,
 * a few kilobytes against the SDK's megabytes on a size-limited runtime. The
 * stored `Content-Type` is the verified one, and keys are unique per upload, so
 * the object can be cached as immutable.
 */
async function putObject(
  settings: StorageSettings,
  key: string,
  body: Uint8Array<ArrayBuffer>,
  contentType: string
): Promise<boolean> {
  const client = new AwsClient({
    accessKeyId: settings.accessKeyId,
    secretAccessKey: settings.secretAccessKey,
    service: "s3",
    region: "auto",
  })
  const response = await client.fetch(
    `https://${settings.accountId}.r2.cloudflarestorage.com/${settings.bucket}/${key}`,
    {
      method: "PUT",
      body,
      headers: {
        "content-type": contentType,
        "cache-control": "public, max-age=31536000, immutable",
        "content-disposition": "inline",
      },
    }
  )
  return response.ok
}
