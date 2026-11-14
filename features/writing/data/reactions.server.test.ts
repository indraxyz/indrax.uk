import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import { beforeEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ getDb: vi.fn() }))
vi.mock("@/lib/db/index.server", async () => ({
  getDb: mocks.getDb,
  schema: await import("@/lib/db/schema"),
}))

import { getReactions, setReaction } from "./reactions.server"

const visitorId = "550e8400-e29b-41d4-a716-446655440000"
const summaryRow = ["2", "0", "1", "0", "0", ["love", "thumbsup"]]

function database(results: unknown[][][]) {
  const query = vi.fn().mockImplementation(() => Promise.resolve({ rows: results.shift() ?? [] }))
  const transaction = vi.fn((queries: Promise<unknown>[]) => Promise.all(queries))
  const client = { query, transaction } as unknown as ReturnType<typeof neon>
  mocks.getDb.mockReturnValue(drizzle(client))
  return { query, transaction }
}

beforeEach(() => vi.resetAllMocks())

it("gets counts and this visitor's selections in one uncached query", async () => {
  const { query, transaction } = database([[summaryRow]])
  expect(await getReactions("article", visitorId)).toEqual({
    counts: { love: 2, noted: 0, thumbsup: 1, fire: 0, rocket: 0 },
    selected: ["love", "thumbsup"],
  })
  expect(query).toHaveBeenCalledTimes(1)
  expect(transaction).not.toHaveBeenCalled()
  const [statement, params] = query.mock.calls[0]
  expect(statement).toContain('"posts"."status" =')
  expect(statement).toContain('"posts"."published_at" is not null')
  expect(statement).toContain('"posts"."published_at" <=')
  expect(statement).toContain('"posts"."content_json" is not null')
  expect(params).toContain(visitorId)
})

it.each([true, false])(
  "sets desired active=%s in one ordered HTTP transaction with public visibility in the write",
  async (active) => {
    const { query, transaction } = database([[], [summaryRow]])
    expect(await setReaction("article", { visitorId, reaction: "love", active })).toEqual({
      counts: { love: 2, noted: 0, thumbsup: 1, fire: 0, rocket: 0 },
      selected: ["love", "thumbsup"],
    })
    expect(transaction).toHaveBeenCalledTimes(1)
    expect(transaction.mock.calls[0][0]).toHaveLength(2)
    expect(query).toHaveBeenCalledTimes(2)
    const [statement] = query.mock.calls[0]
    expect(query.mock.calls[1][0]).toContain("count(*) filter")
    expect(statement).toContain('"posts"."content_json" is not null')
    expect(statement).toContain('"posts"."published_at" <=')
    if (active)
      expect(statement).toContain("on conflict (post_id, visitor_id, reaction) do nothing")
    else expect(statement).toContain('delete from "post_reactions"')
  }
)

it("distinguishes unavailable storage from a missing or private post", async () => {
  mocks.getDb.mockReturnValue(null)
  await expect(getReactions("article")).rejects.toMatchObject({ status: 503 })
  database([[]])
  await expect(getReactions("article")).rejects.toMatchObject({ status: 404 })
})

it.each([true, false])(
  "returns 404 after a hidden-post active=%s batch without a summary row",
  async (active) => {
    const { transaction } = database([[], []])
    await expect(
      setReaction("hidden", { visitorId, reaction: "fire", active })
    ).rejects.toMatchObject({ status: 404 })
    expect(transaction).toHaveBeenCalledTimes(1)
  }
)
