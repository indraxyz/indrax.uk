export class RequestError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
  }
}

/** Bound the stream before JSON parsing, including bodies without Content-Length. */
export async function readJson(request: Request, maxBytes = 512 * 1024): Promise<unknown> {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    throw new RequestError(403, "This request origin is not allowed.")
  if (
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json"
  )
    throw new RequestError(415, "Send an application/json body.")
  const length = Number(request.headers.get("content-length"))
  if (Number.isFinite(length) && length > maxBytes)
    throw new RequestError(413, "The request body is too large.")
  const reader = request.body?.getReader()
  if (!reader) throw new RequestError(400, "A JSON body is required.")
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > maxBytes) {
        await reader.cancel()
        throw new RequestError(413, "The request body is too large.")
      }
      chunks.push(value)
    }
    const body = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) {
      body.set(chunk, offset)
      offset += chunk.length
    }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body)) as unknown
  } catch (error) {
    if (error instanceof RequestError) throw error
    throw new RequestError(400, "The request body is not valid JSON.")
  } finally {
    reader.releaseLock()
  }
}
