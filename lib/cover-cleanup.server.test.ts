import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { drizzle } from "drizzle-orm/neon-http"
import { neon, neonConfig } from "@neondatabase/serverless"
import { schema } from "./db/index.server"
import { drainCoverCleanup } from "./cover-cleanup.server"

const mocks = vi.hoisted(() => ({ storage: vi.fn() }))
vi.mock("./cover-storage.server", async (original) => ({
  ...(await original<typeof import("./cover-storage.server")>()),
  getCoverStorageConfig: mocks.storage,
}))

const key = "covers/550e8400-e29b-41d4-a716-446655440000.png"
const url = `https://media.example.com/${key}`

function fixture(urls = [url], references: { id: string }[][] = []) {
  const remove = vi.fn()
  const where = vi.fn()
  const limit = vi.fn()
  const fetchQuery = vi.fn(
    async (_input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      const { query } = JSON.parse(String(init?.body)) as { query: string }
      let rows: string[][] = []
      let fields: { name: string; dataTypeID: number }[] = []
      if (query.startsWith('select "url"')) {
        rows = urls.map((url) => [url])
        fields = [{ name: "url", dataTypeID: 25 }]
        limit(query)
      } else if (query.startsWith('select "id"')) {
        rows = (references.shift() ?? []).map(({ id }) => [id])
        fields = [{ name: "id", dataTypeID: 25 }]
      } else if (query.startsWith('update "cover_cleanup"')) where(query)
      else if (query.startsWith('delete from "cover_cleanup"')) remove(query)
      return Response.json({
        rows,
        fields,
        rowCount: rows.length,
        command: "SELECT",
        rowAsArray: true,
      })
    }
  )
  neonConfig.fetchFunction = fetchQuery
  const db = drizzle(neon("postgres://test:test@cover-cleanup-test.invalid/db"), { schema })

  const bucketDelete = vi.fn().mockResolvedValue(undefined)
  mocks.storage.mockReturnValue({
    publicUrl: "https://media.example.com",
    bucket: { delete: bucketDelete },
  })
  return { db, remove, where, limit, bucketDelete, fetchQuery }
}

const originalFetch = neonConfig.fetchFunction
beforeEach(() => vi.restoreAllMocks())
afterEach(() => {
  neonConfig.fetchFunction = originalFetch
})

it("awaits R2 deletion before removing the durable cleanup record", async () => {
  const { db, bucketDelete, remove, limit } = fixture()
  await drainCoverCleanup(db)
  expect(bucketDelete).toHaveBeenCalledWith(key)
  expect(remove).toHaveBeenCalledOnce()
  expect(remove.mock.invocationCallOrder[0]).toBeGreaterThan(
    bucketDelete.mock.invocationCallOrder[0]
  )
  expect(limit).toHaveBeenCalledWith(expect.stringContaining("limit $1"))
})

it("retains shared cover or inline-image references without deleting their object", async () => {
  const { db, bucketDelete, remove } = fixture([url], [[{ id: "another-post" }]])
  await drainCoverCleanup(db)
  expect(bucketDelete).not.toHaveBeenCalled()
  expect(remove).not.toHaveBeenCalled()
})

it("retains failed cleanup for a later retry without rejecting the committed mutation", async () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => undefined)
  const { db, bucketDelete, remove } = fixture()
  bucketDelete.mockRejectedValueOnce(new Error("R2 unavailable"))
  await expect(drainCoverCleanup(db)).resolves.toBeUndefined()
  expect(remove).not.toHaveBeenCalled()
  expect(error).toHaveBeenCalledOnce()
  await drainCoverCleanup(db)
  expect(remove).toHaveBeenCalledOnce()
})

it("does not delete external or non-managed keys and rotates them behind newer work", async () => {
  const { db, bucketDelete, remove, where } = fixture(["https://other.example.com/image.png"])
  await drainCoverCleanup(db)
  expect(where).toHaveBeenCalledOnce()
  expect(bucketDelete).not.toHaveBeenCalled()
  expect(remove).not.toHaveBeenCalled()
})

it("retains work when the deployment has no storage configured", async () => {
  const { db, bucketDelete, limit } = fixture()
  mocks.storage.mockReturnValue(null)
  await drainCoverCleanup(db)
  expect(limit).not.toHaveBeenCalled()
  expect(bucketDelete).not.toHaveBeenCalled()
})
