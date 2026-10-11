import { afterEach, beforeEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ author: vi.fn(), storage: vi.fn(), fetch: vi.fn() }))
vi.mock("@/lib/auth-guard.server", () => ({ requireAuthor: mocks.author }))
vi.mock("@/lib/cover-storage.server", () => ({ getCoverStorageConfig: mocks.storage }))

import { POST } from "./upload.server"

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d])
const HTML = new TextEncoder().encode("<!doctype html><script>alert(1)</script>")

function upload(
  body: BodyInit | null,
  { type = "image/png", purpose = "cover", origin = "https://example.test", length = "" } = {}
) {
  const headers = new Headers({ origin, "content-type": type })
  if (length) headers.set("content-length", length)
  return POST(
    new Request(`https://example.test/api/upload?purpose=${purpose}`, {
      method: "POST",
      headers,
      body,
      // Node needs this for a streamed body; browsers and Workers infer it.
      duplex: "half",
    } as RequestInit)
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.author.mockResolvedValue({ id: "author" })
  mocks.storage.mockReturnValue({
    accountId: "account",
    bucket: "media",
    accessKeyId: "test-only",
    secretAccessKey: "test-only",
    publicUrl: "https://media.example.test",
  })
  mocks.fetch.mockResolvedValue(new Response(null, { status: 200 }))
  vi.stubGlobal("fetch", mocks.fetch)
})
afterEach(() => vi.unstubAllGlobals())

it("stores a verified image under a generated key with its verified type", async () => {
  const result = await upload(PNG)
  expect(result.status).toBe(201)
  const { publicUrl } = (await result.json()) as { publicUrl: string }
  expect(publicUrl).toMatch(/^https:\/\/media\.example\.test\/covers\/[0-9a-f-]{36}\.png$/)

  expect(mocks.fetch).toHaveBeenCalledOnce()
  const stored = mocks.fetch.mock.calls[0][0] as Request
  expect(stored.method).toBe("PUT")
  expect(new URL(stored.url).pathname).toBe(`/media${new URL(publicUrl).pathname}`)
  expect(stored.headers.get("content-type")).toBe("image/png")
  expect(stored.headers.get("cache-control")).toContain("immutable")
  expect(stored.headers.get("authorization")).toMatch(/^AWS4-HMAC-SHA256 /)
  expect(new Uint8Array(await stored.arrayBuffer())).toEqual(PNG)
})

it("refuses an unauthenticated caller before reading anything", async () => {
  mocks.author.mockRejectedValue(new Error("Not authorised."))
  expect((await upload(PNG)).status).toBe(401)
  expect(mocks.fetch).not.toHaveBeenCalled()
})

it.each([
  ["a cross-origin request", { origin: "https://evil.test" }, PNG, 403],
  ["an unknown purpose", { purpose: "avatar" }, PNG, 400],
  ["a type the policy does not allow", { type: "image/svg+xml" }, PNG, 415],
  ["HTML labelled as an image", { type: "image/png" }, HTML, 415],
  ["a PNG labelled as JPEG", { type: "image/jpeg" }, PNG, 415],
  ["an empty file", {}, new Uint8Array(), 400],
  ["a declared size over the cap", { length: String(6 * 1024 * 1024) }, PNG, 413],
] as const)("refuses %s without storing it", async (_, options, body, status) => {
  const result = await upload(body, options)
  expect(result.status).toBe(status)
  expect(await result.json()).toHaveProperty("error")
  expect(mocks.fetch).not.toHaveBeenCalled()
})

it("refuses a streamed body past the cap, drains a bounded amount, then cuts it off", async () => {
  let sent = 0
  let cancelled = false
  const chunk = new Uint8Array(1024 * 1024)
  chunk.set(PNG)
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      sent += 1
      controller.enqueue(chunk)
      if (sent >= 40) controller.close()
    },
    cancel() {
      cancelled = true
    },
  })
  const result = await upload(stream)
  expect(result.status).toBe(413)
  // Drained up to the 16 MiB discard limit so the 413 can arrive, then
  // cancelled: a 40 MiB body is never read to the end.
  expect(cancelled).toBe(true)
  expect(sent).toBeLessThan(40)
  expect(mocks.fetch).not.toHaveBeenCalled()
})

it("drains a refused body so its status is delivered rather than a dropped connection", async () => {
  mocks.author.mockRejectedValue(new Error("Not authorised."))
  const request = new Request("https://example.test/api/upload?purpose=cover", {
    method: "POST",
    headers: { origin: "https://example.test", "content-type": "image/png" },
    body: new Uint8Array(2 * 1024 * 1024),
  })
  expect((await POST(request)).status).toBe(401)
  expect(request.bodyUsed).toBe(true)
})

it("validates fully even when no storage is configured", async () => {
  mocks.storage.mockReturnValue(null)
  expect((await upload(HTML)).status).toBe(415)
  expect((await upload(PNG)).status).toBe(501)
  expect(mocks.fetch).not.toHaveBeenCalled()
})

it("reports a storage refusal instead of a public URL", async () => {
  mocks.fetch.mockResolvedValue(new Response(null, { status: 403 }))
  const result = await upload(PNG)
  expect(result.status).toBe(502)
  expect(await result.json()).not.toHaveProperty("publicUrl")
})
