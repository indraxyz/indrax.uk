import { describe, expect, it, vi } from "vitest"
import { cachedRead, invalidateTags } from "./cache.server"
import { getRequest, runWithRequest, serverEnv } from "./runtime.server"

function storage() {
  const values = new Map<string, string>()
  const revisions = new Map<string, number>()
  const kv = {
    get: vi.fn(async (key: string) => (values.has(key) ? JSON.parse(values.get(key)!) : null)),
    put: vi.fn(async (key: string, value: string) => {
      values.set(key, value)
    }),
  }
  const db = {
    prepare: vi.fn(() => ({
      bind: (tag: string, stamp?: number) => ({
        first: async () => revisions.get(tag) ?? null,
        tag,
        stamp,
      }),
    })),
    batch: vi.fn(async (statements: { tag: string; stamp: number }[]) => {
      statements.forEach(({ tag, stamp }) =>
        revisions.set(tag, Math.max(stamp, (revisions.get(tag) ?? 0) + 1))
      )
    }),
  }
  const env = { NEXT_INC_CACHE_KV: kv, NEXT_TAG_CACHE_D1: db }
  return { values, revisions, kv, db, env }
}
function request<T>(env: Record<string, unknown>, run: () => T) {
  return runWithRequest(new Request("https://test.example/"), env, undefined, run)
}
describe("public revision cache", () => {
  it("deduplicates within a request even when storage is unavailable", async () => {
    const load = vi.fn(async () => ({ title: "one" }))
    await request({}, async () => {
      const results = await Promise.all([
        cachedRead("posts", ["posts"], load),
        cachedRead("posts", ["posts"], load),
      ])
      expect(results[0]).toBe(results[1])
    })
    expect(load).toHaveBeenCalledTimes(1)
    await request({}, () => cachedRead("posts", ["posts"], load))
    expect(load).toHaveBeenCalledTimes(2)
  })
  it("uses shared public cache across requests and a new revision after mutation", async () => {
    const { env, kv } = storage()
    const load = vi.fn(async () => ({ title: `revision${load.mock.calls.length}` }))
    const first = await request(env, () => cachedRead("posts", ["posts"], load))
    expect(await request(env, () => cachedRead("posts", ["posts"], load))).toEqual(first)
    expect(load).toHaveBeenCalledTimes(1)
    await request(env, () => invalidateTags("posts", "posts"))
    expect(await request(env, () => cachedRead("posts", ["posts"], load))).not.toEqual(first)
    expect(kv.put).toHaveBeenCalledTimes(2)
    expect(kv.put.mock.calls[0][0]).not.toBe(kv.put.mock.calls[1][0])
  })
  it("clears request memoization after invalidation", async () => {
    const { env } = storage()
    const load = vi.fn(async () => load.mock.calls.length)
    await request(env, async () => {
      expect(await cachedRead("posts", ["posts"], load)).toBe(1)
      await invalidateTags("posts")
      expect(await cachedRead("posts", ["posts"], load)).toBe(2)
    })
  })
  it("keeps overlapping asynchronous request context isolated", async () => {
    const run = (name: string) =>
      request({ SECRET: name }, async () => {
        const original = getRequest()
        await Promise.resolve()
        expect(getRequest()).toBe(original)
        return serverEnv("SECRET")
      })
    expect(await Promise.all([run("first"), run("second")])).toEqual(["first", "second"])
    expect(() => getRequest()).toThrow("No active request")
  })
})
