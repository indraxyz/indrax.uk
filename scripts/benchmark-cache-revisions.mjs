import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { convertV4MiniflareOptions, Miniflare } from "miniflare"
import { cachedRead, invalidateTags } from "../lib/cache.server.ts"
import { runWithRequest } from "../lib/runtime.server.ts"

// Isolated in-memory Workerd/D1 only. No configuration, env file or remote binding
// is loaded. The baseline uses .all rather than .first solely to retain metadata;
// it executes exactly the old one-tag SELECT statement.
const require = createRequire(import.meta.url)
const runtime = new Miniflare(
  convertV4MiniflareOptions({
    modules: true,
    script: "export default { fetch() { return new Response('local revision measurement') } }",
    compatibilityDate: "2026-09-01",
    d1Databases: { DB: "cache-revision-benchmark" },
  })
)

try {
  const db = await runtime.getD1Database("DB")
  await db.exec(
    "CREATE TABLE revalidations (tag TEXT PRIMARY KEY, revalidatedAt INTEGER NOT NULL);" +
      "INSERT INTO revalidations VALUES ('posts', 12), ('post:example', 7);"
  )

  async function scenario(strategy, reads) {
    const memo = new Map()
    let calls = 0
    let rowsRead = 0
    const values = []
    for (const tags of reads) {
      const missing = [...new Set(tags)].filter((tag) => !memo.has(tag))
      if (strategy !== "baseline" && missing.length) {
        calls++
        const result = await db
          .prepare(
            strategy === "in"
              ? `SELECT tag, revalidatedAt FROM revalidations WHERE tag IN (${missing.map(() => "?").join(", ")})`
              : missing
                  .map(() => "SELECT tag, revalidatedAt FROM revalidations WHERE tag = ?")
                  .join(" UNION ALL ")
          )
          .bind(...missing)
          .all()
        rowsRead += result.meta.rows_read
        const revisions = new Map(result.results.map((row) => [row.tag, row.revalidatedAt]))
        for (const tag of missing) memo.set(tag, revisions.get(tag) ?? 0)
      } else if (strategy === "baseline") {
        for (const tag of missing) {
          calls++
          const result = await db
            .prepare("SELECT revalidatedAt FROM revalidations WHERE tag = ?")
            .bind(tag)
            .all()
          rowsRead += result.meta.rows_read
          memo.set(tag, result.results[0]?.revalidatedAt ?? 0)
        }
      }
      values.push(tags.map((tag) => memo.get(tag)))
    }
    return { calls, rowsRead, values }
  }

  const scenarios = [
    { name: "article detail then render", reads: [["posts", "post:example"], ["post:example"]] },
    { name: "missing revision", reads: [["posts", "post:example", "missing"]] },
    {
      name: "repeated request reads",
      reads: [
        ["posts", "post:example"],
        ["posts", "post:example"],
      ],
    },
  ]
  const measurements = []
  for (const { name, reads } of scenarios) {
    const baseline = await scenario("baseline", reads)
    const inQuery = await scenario("in", reads)
    const unionAll = await scenario("union", reads)
    assert.deepEqual(inQuery.values, baseline.values)
    assert.deepEqual(unionAll.values, baseline.values)
    measurements.push({ scenario: name, baseline, inQuery, unionAll })
  }
  // Exercise the production cache owner with real D1 statements as well as
  // comparing SQL alternatives. A minimal KV double keeps revision I/O isolated.
  let calls = 0
  let rowsRead = 0
  const measuredDb = {
    prepare(query) {
      return {
        bind(...parameters) {
          const statement = db.prepare(query).bind(...parameters)
          return {
            async all() {
              calls++
              const result = await statement.all()
              rowsRead += result.meta.rows_read
              return result
            },
          }
        },
      }
    },
    batch: db.batch.bind(db),
  }
  // Invalidation's batch needs ordinary prepared statements; only read calls
  // are wrapped for the measurement below.
  const kv = {
    async get() {
      return null
    },
    async put() {},
  }
  await runWithRequest(
    new Request("https://benchmark.invalid/"),
    { APP_D1: measuredDb, CACHE_KV: kv },
    undefined,
    async () => {
      await cachedRead("detail", ["posts", "post:example"], async () => "detail")
      await cachedRead("render", ["post:example"], async () => "html")
    }
  )
  const productionPath = { calls, rowsRead }
  assert.deepEqual(productionPath, { calls: 1, rowsRead: 2 })

  const clock = Date.now
  try {
    Date.now = () => 12
    await runWithRequest(
      new Request("https://benchmark.invalid/"),
      { APP_D1: db },
      undefined,
      async () => {
        await invalidateTags("posts", "posts")
        await invalidateTags("posts")
      }
    )
  } finally {
    Date.now = clock
  }
  const revision = await db
    .prepare("SELECT revalidatedAt FROM revalidations WHERE tag = ?")
    .bind("posts")
    .first("revalidatedAt")
  assert.equal(revision, 14)
  const invalidation = { before: 12, afterTwoSameClockInvalidations: revision }

  console.log(
    JSON.stringify(
      {
        node: process.version,
        miniflare: require("miniflare/package.json").version,
        compatibilityDate: "2026-09-01",
        conditions:
          "Fresh in-memory local Workerd D1, two indexed revision rows; one run per scenario. Calls count prepared statement executions, rowsRead sums actual D1 meta.rows_read. No remote latency claim.",
        measurements,
        productionPath,
        invalidation,
      },
      null,
      2
    )
  )
} finally {
  await runtime.dispose()
}
