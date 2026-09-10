import "server-only"

import { and, count, desc, eq, inArray, isNotNull, sql } from "drizzle-orm"
import { unstable_cache } from "next/cache"

import { BLOG_CONFIG } from "@/features/blog/config"
import type { PaginatedPosts, Post, PostSummary, Tag, TagWithCount } from "@/features/blog/types"
import { getDb, schema } from "@/lib/db"

/**
 * Cache tags. Every read declares them, and the authoring phase invalidates the
 * same two strings after every mutation, so the names are shared rather than
 * retyped at each call site.
 */
export const CACHE_TAGS = {
  posts: "posts",
  post: (slug: string) => `post:${slug}`,
} as const

// A published post is one that is marked published, has a publication date, and
// has a body. All three matter.
//
// The date keeps a row flipped to published without one from appearing with a
// blank byline. The body closes a gap the expand/contract migration opens: a row
// carrying the old markdown column but no document renders nothing, and without
// this clause it would still be listed in the archive, the feed and the sitemap
// while answering 404 when opened - the archive advertising a link it cannot
// honour. Found by leaving exactly such a row behind locally.
const isPublic = and(
  eq(schema.posts.status, "published"),
  isNotNull(schema.posts.publishedAt),
  isNotNull(schema.posts.contentJson)
)

// Everything a card needs. `content` is absent on purpose - a list page that
// selects article bodies pays for every word it does not show (PRD US-2.1).
const summaryColumns = {
  id: schema.posts.id,
  slug: schema.posts.slug,
  title: schema.posts.title,
  excerpt: schema.posts.excerpt,
  coverUrl: schema.posts.coverUrl,
  coverAlt: schema.posts.coverAlt,
  publishedAt: schema.posts.publishedAt,
  updatedAt: schema.posts.updatedAt,
  readingTime: schema.posts.readingTime,
} as const

const EMPTY_PAGE: PaginatedPosts = { posts: [], page: 1, pageCount: 0 }

export const iso = (value: Date | null) => (value ? value.toISOString() : null)

/**
 * Whether an error is Next's own control flow rather than a failure.
 *
 * Next marks these with a `digest`: `DYNAMIC_SERVER_USAGE`, and the `NEXT_`
 * prefixed signals behind `redirect()` and `notFound()`. They have to travel
 * through any `catch` between where they are thrown and the framework.
 */
function isFrameworkSignal(error: unknown): boolean {
  const digest = (error as { digest?: unknown } | null)?.digest

  return (
    typeof digest === "string" && (digest.startsWith("NEXT_") || digest === "DYNAMIC_SERVER_USAGE")
  )
}

/**
 * How long a read may take before it is treated as a failure.
 *
 * Generous against a Neon cold start, which is around half a second, and far
 * short of a build timing out.
 */
const READ_TIMEOUT_MS = 10_000

/**
 * Runs a read, and turns any failure into the empty result.
 *
 * A blog that cannot reach its database renders as a blog with nothing in it -
 * an empty state on `/blog`, no articles in the feed, the resume page untouched.
 * That is a far better failure than an unhandled exception taking down the only
 * page this site has (PRD US-6.2). The reason is logged server-side with enough
 * context to find it; nothing about the failure reaches the reader.
 *
 * A timeout, not just a `catch`. A database that *hangs* never throws, so a plain
 * try/catch degrades gracefully from errors and not at all from the failure mode
 * that actually happens - a wedged host, a network partition, a connection pool
 * with nothing left to give. Observed rather than theorised: a stuck local
 * container did not fail the sitemap build, it stalled it until the build gave up.
 *
 * The timer does not cancel the query - there is nothing to cancel it with - so a
 * slow read still finishes eventually and is simply ignored. What it bounds is how
 * long anyone waits for it.
 */
async function safely<T>(label: string, fallback: T, read: () => Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined

  try {
    return await Promise.race([
      read(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`timed out after ${READ_TIMEOUT_MS}ms`)),
          READ_TIMEOUT_MS
        )
      }),
    ])
  } catch (error) {
    // Next signals its own control flow by throwing: `DYNAMIC_SERVER_USAGE` to
    // bail a route out of static rendering, `NEXT_REDIRECT` and the not-found
    // fallback for `redirect()` and `notFound()`. Catching those and returning a
    // fallback does not degrade gracefully - it eats the instruction, and the
    // render fails somewhere further on with the cause thrown away.
    //
    // Found exactly that way: tag pages started answering 500 with a masked
    // `DYNAMIC_SERVER_USAGE`, because this wrapper was swallowing the very error
    // Next uses to say "this page is dynamic, render it that way".
    if (isFrameworkSignal(error)) throw error

    console.error(`[blog] ${label} failed`, error)

    return fallback
  } finally {
    // Or the pending timer keeps the process alive for its full duration after an
    // otherwise-instant read - which is exactly how a fast build becomes a slow one.
    clearTimeout(timer)
  }
}

/**
 * Tags for a set of posts, in one round trip rather than one per card.
 *
 * Shared with the admin reads. Those live in their own file because a *post*
 * query that could return a draft must not sit next to one that must not - but
 * this reads no post rows at all, so there is nothing here to get wrong by
 * sharing.
 */
export async function tagsByPost(postIds: string[]): Promise<Map<string, Tag[]>> {
  const grouped = new Map<string, Tag[]>()
  if (postIds.length === 0) return grouped

  const db = getDb()
  if (!db) return grouped

  const rows = await db
    .select({
      postId: schema.postTags.postId,
      id: schema.tags.id,
      name: schema.tags.name,
      slug: schema.tags.slug,
    })
    .from(schema.postTags)
    .innerJoin(schema.tags, eq(schema.tags.id, schema.postTags.tagId))
    .where(inArray(schema.postTags.postId, postIds))
    .orderBy(schema.tags.name)

  for (const { postId, ...tag } of rows) {
    const existing = grouped.get(postId)
    if (existing) existing.push(tag)
    else grouped.set(postId, [tag])
  }

  return grouped
}

async function attachTags(
  rows: (Omit<PostSummary, "tags" | "publishedAt" | "updatedAt"> & {
    publishedAt: Date | null
    updatedAt: Date
  })[]
): Promise<PostSummary[]> {
  const grouped = await tagsByPost(rows.map((row) => row.id))

  return rows.map((row) => ({
    ...row,
    publishedAt: iso(row.publishedAt),
    updatedAt: row.updatedAt.toISOString(),
    tags: grouped.get(row.id) ?? [],
  }))
}

async function readPublishedPosts(page: number): Promise<PaginatedPosts> {
  const db = getDb()
  if (!db) return EMPTY_PAGE

  const [{ total }] = await db.select({ total: count() }).from(schema.posts).where(isPublic)

  const pageCount = Math.ceil(total / BLOG_CONFIG.pageSize)
  // Clamp rather than 404: a stale link to page 9 of a shrinking archive should
  // land somewhere real. `pageCount` is 0 when there is nothing published, and
  // page 1 is still the correct place to render the empty state.
  const current = Math.min(Math.max(page, 1), Math.max(pageCount, 1))

  const rows = await db
    .select(summaryColumns)
    .from(schema.posts)
    .where(isPublic)
    .orderBy(desc(schema.posts.publishedAt))
    .limit(BLOG_CONFIG.pageSize)
    .offset((current - 1) * BLOG_CONFIG.pageSize)

  return { posts: await attachTags(rows), page: current, pageCount }
}

async function readPostsByTag(tagSlug: string, page: number): Promise<PaginatedPosts> {
  const db = getDb()
  if (!db) return EMPTY_PAGE

  const carriesTag = and(
    isPublic,
    sql`exists (
      select 1 from ${schema.postTags}
      inner join ${schema.tags} on ${schema.tags.id} = ${schema.postTags.tagId}
      where ${schema.postTags.postId} = ${schema.posts.id}
        and ${schema.tags.slug} = ${tagSlug}
    )`
  )

  const [{ total }] = await db.select({ total: count() }).from(schema.posts).where(carriesTag)

  const pageCount = Math.ceil(total / BLOG_CONFIG.pageSize)
  const current = Math.min(Math.max(page, 1), Math.max(pageCount, 1))

  const rows = await db
    .select(summaryColumns)
    .from(schema.posts)
    .where(carriesTag)
    .orderBy(desc(schema.posts.publishedAt))
    .limit(BLOG_CONFIG.pageSize)
    .offset((current - 1) * BLOG_CONFIG.pageSize)

  return { posts: await attachTags(rows), page: current, pageCount }
}

async function readPostBySlug(slug: string): Promise<Post | null> {
  const db = getDb()
  if (!db) return null

  const [row] = await db
    .select()
    .from(schema.posts)
    // The status filter lives in the query, not in a caller's `if`. A draft is
    // indistinguishable from a slug that was never used, which is what makes an
    // unpublished post a 404 rather than a 403 (threat T-4).
    .where(and(eq(schema.posts.slug, slug), isPublic))
    .limit(1)

  // A published row with no document is not a post anyone can read. Treating it
  // as absent keeps the failure at the boundary rather than inside the renderer.
  if (!row?.contentJson) return null

  const [summary] = await attachTags([row])

  return {
    ...summary,
    content: row.contentJson,
    status: row.status,
    viewCount: row.viewCount,
  }
}

/**
 * One post by slug regardless of status, for a valid preview token only.
 *
 * Uncached, on purpose. A draft under review changes between refreshes - that is
 * what the review is for - and caching it would also mean an unpublished body
 * sitting in a cache keyed by nothing but the slug (threat T-4).
 *
 * Not exported through the public read layer's guarantees: the caller has already
 * proved it holds a token for this exact slug.
 */
export async function getPostForPreview(slug: string): Promise<Post | null> {
  const db = getDb()
  if (!db) return null

  const [row] = await db.select().from(schema.posts).where(eq(schema.posts.slug, slug)).limit(1)
  if (!row?.contentJson) return null

  const [summary] = await attachTags([row])

  return {
    ...summary,
    content: row.contentJson,
    status: row.status,
    viewCount: row.viewCount,
  }
}

async function readTagsInUse(): Promise<TagWithCount[]> {
  const db = getDb()
  if (!db) return []

  // Only tags that a reader can actually reach. A tag whose every post is a draft
  // has no page, so listing it would be a link to a 404 (PRD US-2.2).
  return db
    .select({
      id: schema.tags.id,
      name: schema.tags.name,
      slug: schema.tags.slug,
      postCount: count(schema.postTags.postId),
    })
    .from(schema.tags)
    .innerJoin(schema.postTags, eq(schema.postTags.tagId, schema.tags.id))
    .innerJoin(schema.posts, eq(schema.posts.id, schema.postTags.postId))
    .where(isPublic)
    .groupBy(schema.tags.id, schema.tags.name, schema.tags.slug)
    .orderBy(schema.tags.name)
}

async function readRecentPosts(limit: number): Promise<PostSummary[]> {
  const db = getDb()
  if (!db) return []

  const rows = await db
    .select(summaryColumns)
    .from(schema.posts)
    .where(isPublic)
    .orderBy(desc(schema.posts.publishedAt))
    .limit(limit)

  return attachTags(rows)
}

/**
 * Other published posts sharing at least one tag with this one.
 *
 * Ranked by how many tags they share before how recent they are, so "also about
 * Postgres and caching" beats "also about TypeScript, and newer". One query with
 * a join and a count, rather than fetching this post's tags and then fetching
 * each tag's posts - which is the same answer at several times the round trips.
 */
async function readRelatedPosts(postId: string, limit: number): Promise<PostSummary[]> {
  const db = getDb()
  if (!db) return []

  const shared = db
    .select({
      postId: schema.postTags.postId,
      shared: count(schema.postTags.tagId).as("shared"),
    })
    .from(schema.postTags)
    .where(
      sql`${schema.postTags.tagId} in (
        select ${schema.postTags.tagId} from ${schema.postTags}
        where ${schema.postTags.postId} = ${postId}
      ) and ${schema.postTags.postId} <> ${postId}`
    )
    .groupBy(schema.postTags.postId)
    .as("shared_tags")

  const rows = await db
    .select(summaryColumns)
    .from(schema.posts)
    .innerJoin(shared, eq(shared.postId, schema.posts.id))
    .where(isPublic)
    .orderBy(desc(shared.shared), desc(schema.posts.publishedAt))
    .limit(limit)

  return attachTags(rows)
}

async function readFeedPosts(): Promise<PostSummary[]> {
  const db = getDb()
  if (!db) return []

  const rows = await db
    .select(summaryColumns)
    .from(schema.posts)
    .where(isPublic)
    .orderBy(desc(schema.posts.publishedAt))
    .limit(BLOG_CONFIG.feedSize)

  return attachTags(rows)
}

async function readPublishedSlugs(): Promise<{ slug: string; updatedAt: string }[]> {
  const db = getDb()
  if (!db) return []

  const rows = await db
    .select({ slug: schema.posts.slug, updatedAt: schema.posts.updatedAt })
    .from(schema.posts)
    .where(isPublic)
    .orderBy(desc(schema.posts.publishedAt))

  return rows.map((row) => ({ slug: row.slug, updatedAt: row.updatedAt.toISOString() }))
}

/*
 * `unstable_cache` rather than the `"use cache"` directive.
 *
 * Next 16 exports both, but `"use cache"` needs `cacheComponents: true`, which
 * flips the entire application to dynamic-by-default with explicit opt-in
 * caching. That is a site-wide behavioural change and does not belong in a
 * feature branch. Both honour the same tags and the same `revalidateTag` calls,
 * so moving across later is mechanical.
 *
 * The wrappers are built once at module scope. Constructing them per call works,
 * but allocates a fresh closure on every request for no benefit.
 */

const cachedPublishedPosts = unstable_cache(readPublishedPosts, ["blog", "published-posts"], {
  tags: [CACHE_TAGS.posts],
})

const cachedPostsByTag = unstable_cache(readPostsByTag, ["blog", "posts-by-tag"], {
  tags: [CACHE_TAGS.posts],
})

const cachedTagsInUse = unstable_cache(readTagsInUse, ["blog", "tags-in-use"], {
  tags: [CACHE_TAGS.posts],
})

const cachedFeedPosts = unstable_cache(readFeedPosts, ["blog", "feed-posts"], {
  tags: [CACHE_TAGS.posts],
})

const cachedRecentPosts = unstable_cache(readRecentPosts, ["blog", "recent-posts"], {
  tags: [CACHE_TAGS.posts],
})

const cachedRelatedPosts = unstable_cache(readRelatedPosts, ["blog", "related-posts"], {
  tags: [CACHE_TAGS.posts],
})

const cachedPublishedSlugs = unstable_cache(readPublishedSlugs, ["blog", "published-slugs"], {
  tags: [CACHE_TAGS.posts],
})

export const getPublishedPosts = (page = 1) =>
  safely("getPublishedPosts", EMPTY_PAGE, () => cachedPublishedPosts(page))

export const getPostsByTag = (tagSlug: string, page = 1) =>
  safely("getPostsByTag", EMPTY_PAGE, () => cachedPostsByTag(tagSlug, page))

export const getTagsInUse = () => safely("getTagsInUse", [] as TagWithCount[], cachedTagsInUse)

export const getFeedPosts = () => safely("getFeedPosts", [] as PostSummary[], cachedFeedPosts)

/** The newest published posts, for the homepage strip. */
export const getRecentPosts = (limit: number) =>
  safely("getRecentPosts", [] as PostSummary[], () => cachedRecentPosts(limit))

/** Published posts sharing a tag with this one. */
export const getRelatedPosts = (postId: string, limit = 3) =>
  safely("getRelatedPosts", [] as PostSummary[], () => cachedRelatedPosts(postId, limit))

export const getPublishedSlugs = () =>
  safely("getPublishedSlugs", [] as { slug: string; updatedAt: string }[], cachedPublishedSlugs)

/**
 * Deliberately NOT wrapped in `safely`.
 *
 * Everywhere else an unreachable database renders as an empty archive, which is
 * the right degradation for a list. Here it would be actively harmful: `null` is
 * how this function says "no such post", the route turns that into `notFound()`,
 * and a published article would answer 404 for as long as the outage lasted. A
 * crawler reads that as "deleted". A thrown error reaches `app/error.tsx` and
 * answers 500 instead, which is both honest and non-destructive (PRD US-6.2).
 *
 * The one wrapper that cannot be hoisted: its tag list names the slug, so it is a
 * different cache entry per post.
 */
export const getPostBySlug = (slug: string) =>
  unstable_cache(readPostBySlug, ["blog", "post-by-slug"], {
    // Tagged both ways so publishing one post does not evict the whole archive,
    // while a change to the archive still reaches the article page.
    tags: [CACHE_TAGS.posts, CACHE_TAGS.post(slug)],
  })(slug)
