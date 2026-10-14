import { afterEach, beforeEach, expect, it, vi } from "vitest"
vi.mock("./auth-guard.server", () => ({
  requireAuthor: vi.fn().mockResolvedValue({ id: "author" }),
}))
import { getCoverStorageConfig } from "./cover-storage.server"
import { serveLocalMedia } from "./local-media.server"
import { runWithRequest } from "./runtime.server"
import { POST } from "./upload.server"
import { isAllowedMediaUrl } from "./utils/media"

const path = "/local-media/covers/51dad294-2e29-40c4-9c1f-2df003c48e57.png"
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
const bucket = { put: vi.fn(), get: vi.fn(), head: vi.fn() }
function context<T>(
  request: Request,
  run: () => T,
  mode = "development",
  origin = "http://127.0.0.1:5173/local-media"
) {
  vi.stubEnv("MEDIA_ORIGIN", origin)
  return runWithRequest(
    request,
    { MEDIA_BUCKET: bucket, NODE_ENV: mode, MEDIA_ORIGIN: origin },
    undefined,
    run
  )
}
function object(contentType = "image/png", size = png.length) {
  return {
    size,
    httpMetadata: { contentType },
    httpEtag: '"local-etag"',
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(png)
        controller.close()
      },
    }),
  }
}
beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.unstubAllEnvs())

it.each([
  "",
  "/local-media",
  "http://localhost:5173/local-media",
  "http://127.0.0.1:9999/local-media",
  "https://media.indrax.uk",
])(
  "keeps uploads disabled when local media configuration is absent or mismatched: %s",
  (origin) => {
    const request = new Request("http://127.0.0.1:5173/api/admin/session")
    expect(context(request, getCoverStorageConfig, "development", origin)).toBeNull()
  }
)

it("enables local uploads with an explicit matching media origin and renders their stored bytes", async () => {
  let storedKey = ""
  bucket.put.mockImplementation(async (key) => {
    storedKey = key
    return { key }
  })
  bucket.get.mockImplementation(async (key) => (key === storedKey ? object() : null))
  const request = new Request("http://127.0.0.1:5173/api/upload?purpose=cover", {
    method: "POST",
    headers: { Origin: "http://127.0.0.1:5173", "Content-Type": "image/png" },
    body: png,
  })
  expect(context(request, getCoverStorageConfig)?.publicUrl).toBe(
    "http://127.0.0.1:5173/local-media"
  )
  const uploaded = await context(request, () => POST(request))
  expect(uploaded.status).toBe(201)
  const { publicUrl } = (await uploaded.json()) as { publicUrl: string }
  expect(isAllowedMediaUrl(publicUrl)).toBe(true)
  const read = new Request(new URL(publicUrl, request.url))
  const response = await context(read, () => serveLocalMedia(read))
  expect(response.status).toBe(200)
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(png)
  expect(response.headers.get("Content-Type")).toBe("image/png")
  expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff")
  expect(response.headers.get("Content-Security-Policy")).toContain("sandbox")
})

it.each([
  ["http://127.0.0.1:5173", "production"],
  ["https://dev.indrax.uk", "development"],
  ["http://127.0.0.1.evil.test", "development"],
])("does not enable local storage on %s in %s", async (origin, mode) => {
  const request = new Request(`${origin}${path}`)
  expect(context(request, getCoverStorageConfig, mode)).toBeNull()
  expect((await context(request, () => serveLocalMedia(request), mode)).status).toBe(404)
  expect(bucket.get).not.toHaveBeenCalled()
})

it.each([
  "/private/secret.txt",
  "/covers/image.svg",
  "/covers/not-a-uuid.png",
  "/covers/%2e%2e%2fsecret.png",
])("refuses keys outside generated covers: %s", async (key) => {
  const request = new Request(`http://127.0.0.1:5173/local-media${key}`)
  expect((await context(request, () => serveLocalMedia(request))).status).toBe(404)
  expect(bucket.get).not.toHaveBeenCalled()
})

it("allows HEAD without fetching the body", async () => {
  bucket.head.mockResolvedValue({
    size: png.length,
    httpMetadata: { contentType: "image/png" },
    httpEtag: '"local-etag"',
  })
  const request = new Request(`http://127.0.0.1:5173${path}`, { method: "HEAD" })
  const response = await context(request, () => serveLocalMedia(request))
  expect(response.status).toBe(200)
  expect(await response.text()).toBe("")
  expect(response.headers.get("Content-Length")).toBe(String(png.length))
  expect(bucket.get).not.toHaveBeenCalled()
})

it.each([
  ["image/svg+xml", 8],
  ["image/jpeg", 8],
  ["image/png", 6 * 1024 * 1024],
])("refuses unsafe or inconsistent stored metadata: %s, %s bytes", async (type, size) => {
  bucket.get.mockResolvedValue(object(type, size))
  const request = new Request(`http://127.0.0.1:5173${path}`)
  expect((await context(request, () => serveLocalMedia(request))).status).toBe(404)
})

it("refuses writes through the local read route", async () => {
  const request = new Request(`http://127.0.0.1:5173${path}`, { method: "DELETE" })
  expect((await context(request, () => serveLocalMedia(request))).status).toBe(405)
  expect(bucket.get).not.toHaveBeenCalled()
})
