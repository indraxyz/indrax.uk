import { and, eq, isNotNull, lte, sql } from "drizzle-orm"

import { getDb, schema, type Database } from "@/lib/db/index.server"
import { RequestError } from "@/lib/request-body.server"
import { REACTIONS, type ReactionInput, type ReactionSummary } from "../reactions"

function database() {
  const db = getDb()
  if (!db) throw new RequestError(503, "Reactions are temporarily unavailable.")
  return db
}

function visiblePost(slug: string) {
  return and(
    eq(schema.posts.slug, slug),
    eq(schema.posts.status, "published"),
    isNotNull(schema.posts.publishedAt),
    lte(schema.posts.publishedAt, new Date()),
    isNotNull(schema.posts.contentJson)
  )
}

async function summary(db: Database, slug: string, visitorId?: string): Promise<ReactionSummary> {
  const reactionCount = (reaction: string) =>
    sql<number>`count(*) filter (where ${schema.postReactions.reaction} = ${reaction})`.mapWith(
      Number
    )
  const [row] = await db
    .select({
      love: reactionCount("love"),
      noted: reactionCount("noted"),
      thumbsup: reactionCount("thumbsup"),
      fire: reactionCount("fire"),
      rocket: reactionCount("rocket"),
      selected: sql<string[]>`coalesce(array_agg(${schema.postReactions.reaction}) filter (
        where ${schema.postReactions.visitorId} = ${visitorId ?? null}::uuid
      ), '{}'::text[])`,
    })
    .from(schema.posts)
    .leftJoin(schema.postReactions, eq(schema.posts.id, schema.postReactions.postId))
    .where(visiblePost(slug))
    .groupBy(schema.posts.id)
  if (!row) throw new RequestError(404, "Post not found.")
  const { selected, ...counts } = row
  return { counts, selected: REACTIONS.filter((reaction) => selected.includes(reaction)) }
}

/** One uncached aggregate; article rendering and its cache never join reactions. */
export async function getReactions(slug: string, visitorId?: string) {
  return summary(database(), slug, visitorId)
}

/** Desired state is retry-safe; visibility is checked in the write statement itself. */
export async function setReaction(slug: string, input: ReactionInput) {
  const db = database()
  if (input.active) {
    await db.execute(sql`
      insert into ${schema.postReactions} (post_id, visitor_id, reaction)
      select ${schema.posts.id}, ${input.visitorId}::uuid, ${input.reaction}
      from ${schema.posts}
      where ${visiblePost(slug)}
      on conflict (post_id, visitor_id, reaction) do nothing
    `)
  } else {
    await db
      .delete(schema.postReactions)
      .where(
        and(
          eq(schema.postReactions.visitorId, input.visitorId),
          eq(schema.postReactions.reaction, input.reaction),
          sql`${schema.postReactions.postId} in (select ${schema.posts.id} from ${schema.posts} where ${visiblePost(slug)})`
        )
      )
  }
  return summary(db, slug, input.visitorId)
}
