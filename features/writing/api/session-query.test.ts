import { afterEach, expect, it, vi } from "vitest"
import { createQueryClient } from "@/components/query-provider"
import { adminApi, type AdminSession } from "./client"
import { adminSessionOptions } from "./session-query"

const author: AdminSession = {
  author: { id: "author", name: "Author", email: "author@example.test" },
  authConfigured: true,
  coverUploadsConfigured: true,
  databaseConfigured: true,
  previewConfigured: true,
}

afterEach(() => vi.restoreAllMocks())

it("deduplicates concurrent session reads and reuses the fresh session", async () => {
  const client = createQueryClient()
  const session = vi.spyOn(adminApi, "session").mockResolvedValue(author)
  try {
    const values = await Promise.all([
      client.fetchQuery(adminSessionOptions),
      client.fetchQuery(adminSessionOptions),
    ])
    expect(values).toEqual([author, author])
    await client.fetchQuery(adminSessionOptions)
    expect(session).toHaveBeenCalledTimes(1)
    expect(session).toHaveBeenCalledWith(expect.any(AbortSignal))
  } finally {
    client.clear()
  }
})

it("revalidates an aged session rather than trusting stale cached access", async () => {
  const client = createQueryClient()
  const session = vi
    .spyOn(adminApi, "session")
    .mockResolvedValue({ author: null, authConfigured: true })
  try {
    client.setQueryData(adminSessionOptions.queryKey, author, {
      updatedAt: Date.now() - 60_001,
    })
    expect((await client.fetchQuery(adminSessionOptions)).author).toBeNull()
    expect(session).toHaveBeenCalledTimes(1)
  } finally {
    client.clear()
  }
})

it("refreshes invalidated sessions even within the freshness window", async () => {
  const client = createQueryClient()
  const session = vi
    .spyOn(adminApi, "session")
    .mockResolvedValue({ author: null, authConfigured: true })
  try {
    client.setQueryData(adminSessionOptions.queryKey, author)
    await client.invalidateQueries({ queryKey: adminSessionOptions.queryKey })
    expect((await client.fetchQuery(adminSessionOptions)).author).toBeNull()
    expect(session).toHaveBeenCalledTimes(1)
  } finally {
    client.clear()
  }
})
