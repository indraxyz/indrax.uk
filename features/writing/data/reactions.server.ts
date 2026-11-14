import { and, eq, sql } from "drizzle-orm"

import { getDb, schema, type Database } from "@/lib/db/index.server"
import { RequestError } from "@/lib/request-body.server"
import { REACTIONS, type ReactionInput, type ReactionSummary } from "../reactions"
import { publicPostCondition } from "./publication.server"

function database() {
  const db = getDb()
  if (!db) throw new RequestError(503, "Reactions are temporarily unavailable.")
  return db
}

function visiblePost(slug: string) {
  return and(eq(schema.posts.slug, slug), publicPostCondition())
}

function summaryQuery(db: Database, slug: string, visitorId?: string) {
  const reactionCount = (reaction: string) =>
    sql<number>`count(*) filter (where ${schema.postReactions.reaction} = ${reaction})`.mapWith(
      Number
    )
  return db
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
}

function mapSummary(rows: Awaited<ReturnType<typeof summaryQuery>>): ReactionSummary {
  const [row] = rows
  if (!row) throw new RequestError(404, "Post not found.")
  const { selected, ...counts } = row
  return { counts, selected: REACTIONS.filter((reaction) => selected.includes(reaction)) }
}

/** One uncached aggregate; article rendering and its cache never join reactions. */
export async function getReactions(slug: string, visitorId?: string) {
  return mapSummary(await summaryQuery(database(), slug, visitorId))
}

/** One ordered HTTP transaction: the aggregate observes this write before responding.
 * Other visitors may commit between statements under PostgreSQL Read Committed;
 * the response is authoritative current state, not an exclusive visitor snapshot.
 */
export async function setReaction(slug: string, input: ReactionInput) {
  const db = database()
  const mutation = input.active
    ? db.execute(sql`
        insert into ${schema.postReactions} (post_id, visitor_id, reaction)
        select ${schema.posts.id}, ${input.visitorId}::uuid, ${input.reaction}
        from ${schema.posts}
        where ${visiblePost(slug)}
        on conflict (post_id, visitor_id, reaction) do nothing
      `)
    : db
        .delete(schema.postReactions)
        .where(
          and(
            eq(schema.postReactions.visitorId, input.visitorId),
            eq(schema.postReactions.reaction, input.reaction),
            sql`${schema.postReactions.postId} in (select ${schema.posts.id} from ${schema.posts} where ${visiblePost(slug)})`
          )
        )
  const [, rows] = await db.batch([mutation, summaryQuery(db, slug, input.visitorId)])
  return mapSummary(rows)
}
