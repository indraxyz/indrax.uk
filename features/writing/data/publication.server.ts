import { and, eq, gt, isNotNull, lte, sql } from "drizzle-orm"

import { getDb, schema } from "@/lib/db/index.server"

const hasPublication = and(
  eq(schema.posts.status, "published"),
  isNotNull(schema.posts.publishedAt),
  isNotNull(schema.posts.contentJson)
)

/** Build at read time: a long-lived Worker must not freeze the publication cutoff. */
export function publicPostCondition(now = new Date()) {
  return and(hasPublication, lte(schema.posts.publishedAt, now))
}

/** Cold cache misses only. Use the original read cutoff even if this query finishes later. */
export async function nextPublicationTime(startedAt: number): Promise<number | undefined> {
  const db = getDb()
  if (!db) return startedAt // Missing configuration must not persist an hour of absence.
  const [row] = await db
    .select({ next: sql<string | null>`min(${schema.posts.publishedAt})` })
    .from(schema.posts)
    .where(and(hasPublication, gt(schema.posts.publishedAt, new Date(startedAt))))
  return row?.next ? new Date(row.next).getTime() : undefined
}
