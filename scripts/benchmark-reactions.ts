/** Disposable, loopback-only benchmark; never loads developer environment files.
 * Run with TEST_DATABASE_URL, TEST_DIRECT_DATABASE_URL and optional output path.
 */
import { randomUUID } from "node:crypto"
import { readFile, writeFile } from "node:fs/promises"
import { performance } from "node:perf_hooks"
import { neonConfig } from "@neondatabase/serverless"
import { Client } from "pg"
import { and, eq, sql } from "drizzle-orm"

import { getDb, schema } from "../lib/db/index.server"
import { getReactions, setReaction } from "../features/writing/data/reactions.server"
import { publicPostCondition } from "../features/writing/data/publication.server"
import type { ReactionInput } from "../features/writing/reactions"

function localUrl(name: string) {
  const value = process.env[name]
  if (!value || !["localhost", "127.0.0.1", "[::1]"].includes(new URL(value).hostname))
    throw new Error(`${name} must explicitly name a disposable loopback database.`)
  return new URL(value)
}
const httpUrl = localUrl("TEST_DATABASE_URL")
const directUrl = localUrl("TEST_DIRECT_DATABASE_URL")
if (httpUrl.pathname !== directUrl.pathname)
  throw new Error("HTTP and direct URLs must name the same disposable database.")
process.env.DATABASE_URL = httpUrl.toString()
const db = getDb()!
const direct = new Client({ connectionString: directUrl.toString() })
const prefix = `reaction-benchmark-${randomUUID()}`
const visitorId = randomUUID()
const sampleCount = Number(process.env.REACTION_BENCHMARK_SAMPLES ?? 30)
if (!Number.isInteger(sampleCount) || sampleCount < 20 || sampleCount > 1000)
  throw new Error("REACTION_BENCHMARK_SAMPLES must be an integer from 20 to 1000.")
const warmupCount = 5
const sqlOnly = process.env.REACTION_BENCHMARK_SQL_ONLY === "true"
const output = process.argv[2] ?? "/tmp/reaction-benchmark.json"
const nativeFetch = globalThis.fetch
const previousFetch = neonConfig.fetchFunction
let requests = 0
let statements: { query: string; params: unknown[] }[] = []
const countedFetch: typeof fetch = (input, init) => {
  requests++
  if (typeof init?.body === "string") {
    const body = JSON.parse(init.body)
    statements.push(...(body.queries ?? [body]))
  }
  return nativeFetch(input, init)
}
neonConfig.fetchFunction = countedFetch

function percentile(values: number[], fraction: number) {
  const sorted = [...values].sort((a, b) => a - b)
  return Number(sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)].toFixed(3))
}
async function measure(run: () => Promise<unknown>) {
  requests = 0
  statements = []
  const start = performance.now()
  await run()
  return { milliseconds: performance.now() - start, requests }
}
async function samples(run: () => Promise<unknown>, prepare?: () => Promise<unknown>) {
  for (let index = 0; index < warmupCount; index++) {
    await prepare?.()
    await run()
  }
  const observations = []
  for (let index = 0; index < sampleCount; index++) {
    await prepare?.()
    observations.push(await measure(run))
  }
  return {
    samples: sampleCount,
    p50Ms: percentile(
      observations.map((sample) => sample.milliseconds),
      0.5
    ),
    p95Ms: percentile(
      observations.map((sample) => sample.milliseconds),
      0.95
    ),
    requestsPerOperation: [...new Set(observations.map((sample) => sample.requests))],
    milliseconds: observations.map((sample) => Number(sample.milliseconds.toFixed(3))),
  }
}

/** The prior path, using the same predicate, desired-state SQL and production aggregate. */
async function sequential(slug: string, input: ReactionInput) {
  const visible = and(eq(schema.posts.slug, slug), publicPostCondition())
  if (input.active) {
    await db.execute(sql`
      insert into ${schema.postReactions} (post_id, visitor_id, reaction)
      select ${schema.posts.id}, ${input.visitorId}::uuid, ${input.reaction}
      from ${schema.posts} where ${visible}
      on conflict (post_id, visitor_id, reaction) do nothing
    `)
  } else {
    await db
      .delete(schema.postReactions)
      .where(
        and(
          eq(schema.postReactions.visitorId, input.visitorId),
          eq(schema.postReactions.reaction, input.reaction),
          sql`${schema.postReactions.postId} in (select ${schema.posts.id} from ${schema.posts} where ${visible})`
        )
      )
  }
  return getReactions(slug, input.visitorId)
}

const fixtures: string[] = []
try {
  await direct.connect()
  const version = (await direct.query<{ version: string }>("select version() as version")).rows[0]
  const driverPackage = JSON.parse(
    await readFile(
      new URL("../node_modules/@neondatabase/serverless/package.json", import.meta.url),
      "utf8"
    )
  )
  const drizzlePackage = JSON.parse(
    await readFile(new URL("../node_modules/drizzle-orm/package.json", import.meta.url), "utf8")
  )
  const datasets = []
  for (const size of [0, 100, 10_000, 100_000]) {
    const postId = randomUUID()
    const slug = `${prefix}-${size}`
    fixtures.push(postId)
    await db.insert(schema.posts).values({
      id: postId,
      slug,
      title: "Disposable reaction benchmark",
      status: "published",
      publishedAt: new Date("2020-01-01T00:00:00Z"),
      contentJson: { type: "doc", content: [{ type: "paragraph" }] },
    })
    // Each visitor chooses up to three distinct emoji. All five types are balanced.
    // Direct SQL is fixture preparation only; measurements use the real HTTP driver.
    await direct.query(
      `insert into post_reactions (post_id, visitor_id, reaction)
       select $1::uuid, md5('visitor-' || ((i - 1) / 3)::text)::uuid,
         (array['love','noted','thumbsup','fire','rocket'])[
           (((i - 1) / 3 + (i - 1) % 3) % 5 + 1)::int]
       from generate_series(1, $2::int) as g(i)`,
      [postId, size]
    )
    await direct.query("analyze post_reactions")
    const firstObservedRead = await measure(() => getReactions(slug, visitorId))
    const aggregate = statements[0]
    const plan = await direct.query(
      `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${aggregate.query}`,
      aggregate.params
    )
    const timingOffPlan = await direct.query(
      `EXPLAIN (ANALYZE, BUFFERS, TIMING OFF, FORMAT JSON) ${aggregate.query}`,
      aggregate.params
    )
    const directSummary = await samples(() => direct.query(aggregate.query, aggregate.params))
    if (sqlOnly) {
      datasets.push({
        reactions: size,
        visitors: Math.ceil(size / 3),
        directSummary,
        explain: plan.rows[0]["QUERY PLAN"],
        explainTimingOff: timingOffPlan.rows[0]["QUERY PLAN"],
      })
      console.log(`SQL ${size} rows: p50 ${directSummary.p50Ms}, p95 ${directSummary.p95Ms}ms`)
      continue
    }
    const anonymousRead = await samples(() => getReactions(slug))
    const seededVisitorId = (
      await direct.query<{ id: string }>("select md5('visitor-0')::uuid as id")
    ).rows[0].id
    const identifiedRead = await samples(() => getReactions(slug, seededVisitorId))
    const add: ReactionInput = { visitorId, reaction: "love", active: true }
    const remove: ReactionInput = { ...add, active: false }
    const sequentialAdd = await samples(
      () => sequential(slug, add),
      () => sequential(slug, remove)
    )
    const batchedAdd = await samples(
      () => setReaction(slug, add),
      () => setReaction(slug, remove)
    )
    const sequentialRemove = await samples(
      () => sequential(slug, remove),
      () => sequential(slug, add)
    )
    const batchedRemove = await samples(
      () => setReaction(slug, remove),
      () => setReaction(slug, add)
    )
    datasets.push({
      reactions: size,
      visitors: Math.ceil(size / 3),
      firstObservedRead,
      directSummary,
      explainTimingOff: timingOffPlan.rows[0]["QUERY PLAN"],
      anonymousRead,
      identifiedRead,
      sequentialAdd,
      batchedAdd,
      sequentialRemove,
      batchedRemove,
      explain: plan.rows[0]["QUERY PLAN"],
    })
    console.log(
      `Measured ${size} reactions; read p95 ${identifiedRead.p95Ms}ms; add ${sequentialAdd.p95Ms} → ${batchedAdd.p95Ms}ms; remove ${sequentialRemove.p95Ms} → ${batchedRemove.p95Ms}ms`
    )
  }
  const result = {
    measuredAt: new Date().toISOString(),
    node: process.version,
    postgres: version.version,
    neonDriver: driverPackage.version,
    drizzle: drizzlePackage.version,
    transport: "Node → loopback Neon HTTP proxy → disposable PostgreSQL; no artificial RTT",
    cacheConditions:
      "Fixtures inserted and ANALYZEd before first observed read; warm shared buffers. First observed latency is not a cold-storage or Neon scale-to-zero measurement.",
    sqlOnly,
    sampleCount,
    warmupCount,
    distribution:
      "Up to three distinct emoji per visitor, balanced across all five reaction types; identified reads select the first seeded visitor, writes use an independent visitor.",
    budget: { identifiedReadP95At100kMs: 100, materialWriteP95RegressionPercent: 10 },
    datasets,
  }
  await writeFile(output, JSON.stringify(result, null, 2) + "\n")
  console.log(`Wrote ${output}`)
} finally {
  neonConfig.fetchFunction = previousFetch
  // Delete only this run's UUID fixtures. Cascade removes their reaction rows.
  if (fixtures.length)
    await direct.query("delete from posts where id = any($1::uuid[])", [fixtures])
  await direct.end()
}
