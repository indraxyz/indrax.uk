export class RequestError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
  }
}

/**
 * Mutations accept only this origin (threat T-9).
 *
 * Paired with a non-form content type, which forces a CORS preflight, a
 * cross-site page cannot send an authenticated mutation at all.
 */
export function assertSameOrigin(request: Request): void {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    throw new RequestError(403, "This request origin is not allowed.")
}

/** The media type without parameters, lower-cased; empty when absent. */
export function mediaTypeOf(request: Request): string {
  return request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ?? ""
}

/**
 * Reads the whole body, refusing it once it passes `maxBytes`.
 *
 * Bounded while streaming, not after: a declared `Content-Length` is checked up
 * front, and a body that lies about it or omits it stops being read at the cap,
 * so nothing larger is ever held in memory.
 */
export async function readBoundedBody(
  request: Request,
  maxBytes: number
): Promise<Uint8Array<ArrayBuffer>> {
  const length = Number(request.headers.get("content-length"))
  if (Number.isFinite(length) && length > maxBytes)
    throw new RequestError(413, "The request body is too large.")
  const reader = request.body?.getReader()
  if (!reader) throw new RequestError(400, "A request body is required.")
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      // Stop reading at the cap. The rest is left unread rather than cancelled,
      // so a route can still `discardBody` it and deliver its 413 cleanly.
      if (size > maxBytes) throw new RequestError(413, "The request body is too large.")
      chunks.push(value)
    }
  } catch (error) {
    if (error instanceof RequestError) throw error
    throw new RequestError(400, "The request body could not be read.")
  } finally {
    reader.releaseLock()
  }
  const body = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.length
  }
  return body
}

/**
 * Reads and drops whatever is left of a refused body, up to `limitBytes`.
 *
 * Answering before the client has finished sending makes many clients and
 * proxies report a dropped connection instead of the status, so a refusal of
 * a few-megabyte upload would surface as a network error. Draining lets the
 * 401/413/415 arrive. Past `limitBytes` - declared or actual - the body is
 * cancelled instead: nobody gets to keep the Worker reading indefinitely.
 */
export async function discardBody(request: Request, limitBytes: number): Promise<void> {
  const body = request.body
  if (!body || body.locked) return
  const reader = body.getReader()
  try {
    const declared = Number(request.headers.get("content-length"))
    if (Number.isFinite(declared) && declared > limitBytes) return void (await reader.cancel())
    let size = 0
    while (true) {
      const { value, done } = await reader.read()
      if (done) return
      size += value.byteLength
      if (size > limitBytes) return void (await reader.cancel())
    }
  } catch {
    // The client went away; there is nothing left to drain.
  } finally {
    reader.releaseLock()
  }
}

/** Bound the stream before JSON parsing, including bodies without Content-Length. */
export async function readJson(request: Request, maxBytes = 512 * 1024): Promise<unknown> {
  assertSameOrigin(request)
  if (mediaTypeOf(request) !== "application/json")
    throw new RequestError(415, "Send an application/json body.")
  const body = await readBoundedBody(request, maxBytes).catch((error: unknown) => {
    if (error instanceof RequestError && error.status === 400)
      throw new RequestError(400, "A JSON body is required.")
    throw error
  })
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body)) as unknown
  } catch {
    throw new RequestError(400, "The request body is not valid JSON.")
  }
}
