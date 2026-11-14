import { afterEach, describe, expect, it, vi } from "vitest"
import { cachedRead, invalidateTags } from "./cache.server"
import { getRequest, runWithRequest, serverEnv } from "./runtime.server"

function storage() {
  const values = new Map<string, string>()
  const revisions = new Map<string, number>()
  const select = vi.fn(async (tags: string[]) => ({
    results: tags.flatMap((tag) =>
      revisions.has(tag) ? [{ tag, revalidatedAt: revisions.get(tag)! }] : []
    ),
  }))
  const kv = {
    get: vi.fn(async (key: string) => (values.has(key) ? JSON.parse(values.get(key)!) : null)),
    put: vi.fn(async (key: string, value: string, options: { expirationTtl: number }) => {
      if (options.expirationTtl < 60) throw new Error("KV requires at least 60 seconds")
      values.set(key, value)
    }),
  }
  const db = {
    prepare: vi.fn((query: string) => ({
      query,
      bind: (...parameters: (string | number)[]) => ({
        all: () => select(parameters as string[]),
        tag: parameters[0] as string,
        stamp: parameters[1] as number,
      }),
    })),
    batch: vi.fn(async (statements: { tag: string; stamp: number }[]) => {
      statements.forEach(({ tag, stamp }) =>
        revisions.set(tag, Math.max(stamp, (revisions.get(tag) ?? 0) + 1))
      )
    }),
  }
  const env = { CACHE_KV: kv, APP_D1: db }
  return { values, revisions, kv, db, env, select }
}
function request<T>(env: Record<string, unknown>, run: () => T) {
  return runWithRequest(new Request("https://test.example/"), env, undefined, run)
}
function controlledClock() {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date("2026-11-14T00:00:00Z"))
  return Date.now()
}
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

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

  it("batches missing revisions and reuses pending tags across overlapping reads", async () => {
    const { env, db, revisions, select } = storage()
    revisions.set("posts", 12)
    revisions.set("post:one", 7)
    await request(env, async () => {
      await Promise.all([
        cachedRead("detail", ["posts", "post:one", "posts"], async () => "detail"),
        cachedRead("render", ["post:one"], async () => "html"),
        cachedRead("related", ["posts", "other"], async () => []),
      ])
    })
    expect(select.mock.calls).toEqual([[["posts", "post:one"]], [["other"]]])
    expect(db.prepare.mock.calls[0][0]).toBe(
      "SELECT tag, revalidatedAt FROM revalidations WHERE tag = ? UNION ALL SELECT tag, revalidatedAt FROM revalidations WHERE tag = ?"
    )
    expect(db.prepare.mock.calls[1][0]).toBe(
      "SELECT tag, revalidatedAt FROM revalidations WHERE tag = ?"
    )
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

  it("treats absent revisions as zero and increments them at an unchanged clock", async () => {
    const stamp = controlledClock()
    const { env, kv, revisions, select } = storage()
    const load = vi.fn(async () => "article")
    await request(env, () => cachedRead("post", ["missing"], load))
    revisions.set("missing", 0)
    await request(env, () => cachedRead("post", ["missing"], load))
    expect(load).toHaveBeenCalledTimes(1)
    expect(select).toHaveBeenCalledTimes(2)
    await request(env, () => invalidateTags("missing", "missing"))
    expect(revisions.get("missing")).toBe(stamp)
    await request(env, () => invalidateTags("missing"))
    expect(revisions.get("missing")).toBe(stamp + 1)
    await request(env, () => cachedRead("post", ["missing"], load))
    expect(kv.put).toHaveBeenCalledTimes(2)
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

  it("does not repopulate stale revision memoization when invalidation overlaps a lookup", async () => {
    const { env, select } = storage()
    let finish!: (value: { results: { tag: string; revalidatedAt: number }[] }) => void
    select.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)))
    await request(env, async () => {
      const before = cachedRead("post", ["posts"], async () => "old")
      await invalidateTags("posts")
      expect(await cachedRead("post", ["posts"], async () => "new")).toBe("new")
      finish({ results: [] })
      expect(await before).toBe("old")
      expect(await cachedRead("other", ["posts"], async () => "other")).toBe("other")
      expect(select).toHaveBeenCalledTimes(2)
    })
    expect(await request(env, () => cachedRead("post", ["posts"], async () => "wrong"))).toBe("new")
  })

  it.each([
    { label: "absent detail", before: null, after: { slug: "scheduled" } },
    { label: "empty list", before: [], after: [{ slug: "scheduled" }] },
  ])("expires cached $label within the publication freshness bound", async ({ before, after }) => {
    const start = controlledClock()
    const { env, kv } = storage()
    const load = vi.fn(async () => (Date.now() < start + 30_000 ? before : after))
    const read = () =>
      request(env, () => cachedRead("publication", ["posts"], load, { lifetimeSeconds: 60 }))
    expect(await read()).toEqual(before)
    vi.setSystemTime(start + 59_999)
    expect(await read()).toEqual(before)
    expect(load).toHaveBeenCalledTimes(1)
    vi.setSystemTime(start + 60_000)
    expect(await read()).toEqual(after)
    expect(load).toHaveBeenCalledTimes(2)
    expect(kv.put.mock.calls[0][2]).toEqual({ expirationTtl: 60 })
  })

  it("anchors freshness before revision reads and slow loaders rather than at completion", async () => {
    const start = controlledClock()
    const { env, values } = storage()
    const load = vi.fn(async () => {
      vi.setSystemTime(start + 59_000)
      return null
    })
    await request(env, () => cachedRead("future", ["posts"], load, { lifetimeSeconds: 60 }))
    expect(JSON.parse([...values.values()][0]).expiresAt).toBe(start + 60_000)
    vi.setSystemTime(start + 60_000)
    expect(
      await request(env, () =>
        cachedRead("future", ["posts"], async () => "published", { lifetimeSeconds: 60 })
      )
    ).toBe("published")
  })

  it("does not persist a result whose loader outlives its freshness bound", async () => {
    const start = controlledClock()
    const { env, kv } = storage()
    await request(env, () =>
      cachedRead(
        "slow",
        ["posts"],
        async () => {
          vi.setSystemTime(start + 60_000)
          return null
        },
        { lifetimeSeconds: 60 }
      )
    )
    expect(kv.put).not.toHaveBeenCalled()
  })

  it("checks a publication deadline only on cold misses and expires at that boundary", async () => {
    const start = controlledClock()
    const { env, kv } = storage()
    const freshUntil = vi.fn(async (): Promise<number | undefined> => start + 10_000)
    const load = vi.fn(async () => load.mock.calls.length)
    const read = () => request(env, () => cachedRead("scheduled", ["posts"], load, { freshUntil }))
    expect(await read()).toBe(1)
    expect(freshUntil).toHaveBeenCalledWith(start)
    expect(await read()).toBe(1)
    expect(freshUntil).toHaveBeenCalledTimes(1)
    vi.setSystemTime(start + 9_999)
    expect(await read()).toBe(1)
    vi.setSystemTime(start + 10_000)
    freshUntil.mockResolvedValue(undefined)
    expect(await read()).toBe(2)
    expect(freshUntil).toHaveBeenCalledTimes(2)
    vi.setSystemTime(start + 70_000)
    expect(await read()).toBe(2)
    expect(kv.put).toHaveBeenCalledTimes(2)
    expect(kv.put.mock.calls[0][2].expirationTtl).toBe(3600)
  })

  it("serves loaded data without caching when the expiry-policy query fails", async () => {
    controlledClock()
    const { env, kv } = storage()
    vi.spyOn(console, "error").mockImplementation(() => {})
    const load = vi.fn(async () => "readable")
    const freshUntil = vi.fn(async () => {
      throw new Error("deadline unavailable")
    })
    expect(await request(env, () => cachedRead("article", ["posts"], load, { freshUntil }))).toBe(
      "readable"
    )
    expect(kv.put).not.toHaveBeenCalled()
  })

  it("does not query publication deadlines when persistent bindings are absent", async () => {
    const freshUntil = vi.fn(async () => undefined)
    expect(
      await request({}, () => cachedRead("article", [], async () => "readable", { freshUntil }))
    ).toBe("readable")
    expect(freshUntil).not.toHaveBeenCalled()
  })

  it("separates lifetimes in request and persistent keys and versions the namespace", async () => {
    controlledClock()
    const { env, kv } = storage()
    const load = vi.fn(async () => "value")
    await request(env, async () => {
      await cachedRead("same", [], load)
      await cachedRead("same", [], load, { lifetimeSeconds: 60 })
    })
    expect(load).toHaveBeenCalledTimes(2)
    expect(kv.put.mock.calls.map((call) => call[2].expirationTtl)).toEqual([3600, 60])
    expect(kv.put.mock.calls[0][0]).toMatch(/^react-router:v2:/)
    expect(kv.put.mock.calls[0][0]).not.toBe(kv.put.mock.calls[1][0])
  })

  it.each([0, 59, 60.5, NaN, Infinity])("refuses unsupported lifetime %s", (lifetimeSeconds) => {
    expect(() => cachedRead("key", [], async () => null, { lifetimeSeconds })).toThrow(RangeError)
  })

  it.each(["revision read", "KV read", "KV write"])(
    "falls back gracefully after %s failure",
    async (failure) => {
      const { env, kv, select } = storage()
      const log = vi.spyOn(console, "error").mockImplementation(() => {})
      if (failure === "revision read") select.mockRejectedValueOnce(new Error("D1 unavailable"))
      if (failure === "KV read") kv.get.mockRejectedValueOnce(new Error("KV unavailable"))
      if (failure === "KV write") kv.put.mockRejectedValueOnce(new Error("KV full"))
      const load = vi.fn(async () => "uncached value")
      expect(await request(env, () => cachedRead("key", ["posts"], load))).toBe("uncached value")
      expect(load).toHaveBeenCalledTimes(1)
      expect(log).toHaveBeenCalled()
    }
  )

  it("surfaces failed invalidation instead of claiming a successful mutation", async () => {
    const { env, db } = storage()
    db.batch.mockRejectedValueOnce(new Error("D1 write failed"))
    await expect(request(env, () => invalidateTags("posts"))).rejects.toThrow("D1 write failed")
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
