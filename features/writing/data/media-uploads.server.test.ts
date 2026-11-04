import { afterEach, beforeEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ storage: vi.fn(), db: vi.fn() }))
vi.mock("@/lib/cover-storage.server", async (original) => ({
  ...(await original<typeof import("@/lib/cover-storage.server")>()),
  getCoverStorageConfig: mocks.storage,
}))
vi.mock("@/lib/db/index.server", async (original) => ({
  ...(await original<typeof import("@/lib/db/index.server")>()),
  getDb: mocks.db,
}))

import { collectManagedUploadKeys, registerPendingUpload } from "./media-uploads.server"
import { runWithRequest } from "@/lib/runtime.server"

const first = "content/550e8400-e29b-41d4-a716-446655440000.png"
const second = "covers/550e8400-e29b-41d4-a716-446655440001.webp"
const origin = "https://media.example.test"
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv("MEDIA_ORIGIN", "")
  mocks.storage.mockReturnValue({ publicUrl: origin })
})
afterEach(() => vi.unstubAllEnvs())

it("collects and deduplicates managed images from covers and nested content", () => {
  expect(
    collectManagedUploadKeys(`${origin}/${second}`, {
      type: "doc",
      content: [
        {
          type: "blockquote",
          content: [
            { type: "image", attrs: { src: `${origin}/${first}` } },
            { type: "image", attrs: { src: `${origin}/${second}` } },
            { type: "image", attrs: { src: `${origin}/${first}` } },
          ],
        },
      ],
    })
  ).toEqual([first, second])
})

it("excludes third-party, malformed and non-generated media sources", () => {
  expect(
    collectManagedUploadKeys("https://other.example.test/covers/photo.png", {
      type: "doc",
      content: [
        { type: "image", attrs: { src: `https://other.example.test/${first}` } },
        { type: "image", attrs: { src: `${origin}/content/manual.png` } },
        { type: "image", attrs: { src: `https://user:secret@media.example.test/${first}` } },
        { type: "image", attrs: { src: "not a URL" } },
        { type: "image", attrs: { src: 123 } },
      ],
    })
  ).toEqual([])
})

it("attaches query and fragment variants to their original tracked key", () => {
  expect(
    collectManagedUploadKeys(`${origin}/${second}?cache=1#cover`, {
      type: "doc",
      content: [
        { type: "image", attrs: { src: `${origin}/${first}?v=1` } },
        { type: "image", attrs: { src: `${origin}/${first}#illustration` } },
        { type: "image", attrs: { src: `${origin}/${first}` } },
      ],
    })
  ).toEqual([first, second])
})

it("matches stored generated keys after changing the local development port", () => {
  mocks.storage.mockReturnValue({ publicUrl: "http://localhost:5174/local-media" })
  expect(
    collectManagedUploadKeys(null, {
      type: "doc",
      content: [
        { type: "image", attrs: { src: `http://localhost:5173/local-media/${first}?v=1#image` } },
      ],
    })
  ).toEqual([first])
})

it("does not attach arbitrary assets when storage is unavailable", () => {
  mocks.storage.mockReturnValue(null)
  expect(collectManagedUploadKeys(`${origin}/${second}`, { type: "doc" })).toEqual([])
})

it("keeps attachment guards active with a configured origin but no R2 binding", () => {
  mocks.storage.mockReturnValue(null)
  vi.stubEnv("MEDIA_ORIGIN", origin)
  expect(
    collectManagedUploadKeys(`${origin}/${second}?v=1`, {
      type: "doc",
      content: [
        { type: "image", attrs: { src: `${origin}/${first}#image` } },
        { type: "image", attrs: { src: `https://other.example.test/${first}?v=1` } },
      ],
    })
  ).toEqual([first, second])
})

it("uses the runtime media scope before the process fallback without storage", () => {
  mocks.storage.mockReturnValue(null)
  vi.stubEnv("MEDIA_ORIGIN", origin)
  const configured = "https://runtime-media.example.test"
  expect(
    runWithRequest(
      new Request("https://site.example.test/admin/posts"),
      { MEDIA_ORIGIN: configured },
      undefined,
      () =>
        collectManagedUploadKeys(`${origin}/${second}`, {
          type: "doc",
          content: [{ type: "image", attrs: { src: `${configured}/${first}?v=1#image` } }],
        })
    )
  ).toEqual([first])
})

it("refuses upload registration without a database", async () => {
  mocks.db.mockReturnValue(null)
  expect(await registerPendingUpload(first, `${origin}/${first}`)).toBe(false)
})

it("registers the pending asset before its caller may write storage", async () => {
  const values = vi.fn().mockResolvedValue(undefined)
  mocks.db.mockReturnValue({ insert: vi.fn().mockReturnValue({ values }) })
  expect(await registerPendingUpload(first, `${origin}/${first}`)).toBe(true)
  expect(values).toHaveBeenCalledExactlyOnceWith({ key: first, url: `${origin}/${first}` })
})

it("does not permit arbitrary keys in the upload ledger", async () => {
  const insert = vi.fn()
  mocks.db.mockReturnValue({ insert })
  await expect(
    registerPendingUpload("content/manual.png", `${origin}/content/manual.png`)
  ).rejects.toThrow("generated media key")
  expect(insert).not.toHaveBeenCalled()
})
