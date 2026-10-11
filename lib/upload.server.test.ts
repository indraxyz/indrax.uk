import { beforeEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ author: vi.fn(), storage: vi.fn() }))
vi.mock("@/lib/auth-guard.server", () => ({ requireAuthor: mocks.author }))
vi.mock("@/lib/cover-storage.server", () => ({ getCoverStorageConfig: mocks.storage }))

import { POST } from "./upload.server"

const mint = (body: unknown) =>
  POST(
    new Request("https://example.test/api/upload", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://example.test" },
      body: JSON.stringify(body),
    })
  )

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
})

it("binds the image content type into the presigned URL signature", async () => {
  const result = await mint({ contentType: "image/png", size: 1024, fileName: "cover.png" })
  expect(result.status).toBe(200)
  const { uploadUrl, contentType } = (await result.json()) as {
    uploadUrl: string
    contentType: string
  }
  expect(contentType).toBe("image/png")
  const signed = new URL(uploadUrl)
  // A PUT with any other Content-Type (text/html, say) no longer matches the signature.
  expect(signed.searchParams.get("X-Amz-SignedHeaders")?.split(";")).toContain("content-type")
  expect(signed.searchParams.get("X-Amz-Expires")).toBe("300")
  expect(signed.pathname).toMatch(/^\/media\/covers\/[0-9a-f-]{36}\.png$/)
})

it("refuses to mint for an unauthenticated caller", async () => {
  mocks.author.mockRejectedValue(new Error("Not authorised."))
  const result = await mint({ contentType: "image/png", size: 1024, fileName: "cover.png" })
  expect(result.status).toBe(401)
})

it.each([
  { contentType: "text/html", size: 1024, fileName: "x.html" },
  { contentType: "image/png", size: 50 * 1024 * 1024, fileName: "huge.png" },
])("refuses a disallowed request before minting (%o)", async (body) => {
  expect((await mint(body)).status).toBe(400)
})
