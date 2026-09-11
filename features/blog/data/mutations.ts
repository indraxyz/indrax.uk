"use server"

import { and, eq, inArray, ne } from "drizzle-orm"
import { updateTag } from "next/cache"

import { BLOG_CONFIG } from "@/features/blog/config"
import { CACHE_TAGS } from "@/features/blog/data/queries"
import type { ActionResult, PostDocument, PostStatus } from "@/features/blog/types"
import { deriveExcerpt, plainText } from "@/features/blog/utils/content"
import { computeReadingTime } from "@/features/blog/utils/reading-time"
import { createPreviewToken } from "@/features/blog/utils/preview-token"
import { slugify, uniqueSlug } from "@/features/blog/utils/slug"
import { requireAuthor } from "@/lib/auth-guard"
import { isSeriesOrderClash } from "@/features/blog/data/db-errors"
import { getDb, schema } from "@/lib/db"
import { postIdSchema, postInputSchema } from "@/lib/validators/blog"

/**
 * Everything that writes a post.
 *
 * Two rules hold across all of them, and neither is delegated upwards.
 *
 * **Authorisation is re-checked here.** `proxy.ts` redirects a browser away from
 * `/admin`, but a server action is a POST that a caller can make directly, with no
 * routing in the way. So each action starts with `requireAuthor()` rather than
 * assuming that whatever rendered the form was allowed to (threat T-3).
 *
 * **Input is validated here.** The Zod schema is the same one the seed uses, and
 * the fields it does not accept are as important as the ones it does:
 * `readingTime`, `publishedAt`, `createdAt` and `updatedAt` are all computed
 * server-side, because a client has no business asserting any of them.
 */

const failure = (message: string, errors?: Record<string, string[]>): ActionResult => ({
  ok: false,
  message,
  errors,
})

/**
 * Invalidate everything a change to one post can be seen through.
 *
 * The archive, the tag pages, the feed and the sitemap all read through the
 * `posts` tag; the article page also carries a per-slug tag so publishing one post
 * does not evict the whole archive. A slug change touches two article entries -
 * the old URL has to stop being served from cache as much as the new one has to
 * start (PRD US-3.2).
 *
 * `updateTag`, not `revalidateTag`. Next 16 made the latter take a cache-life
 * profile and expire lazily; the former is the server-action form and expires
 * immediately with read-your-own-writes. Which matters here for an obvious reason:
 * the author is redirected straight to the page they just saved, and being shown
 * the previous version of their own edit reads as data loss.
 */
function revalidatePost(...slugs: (string | null | undefined)[]) {
  updateTag(CACHE_TAGS.posts)

  for (const slug of new Set(slugs.filter((value): value is string => Boolean(value)))) {
    updateTag(CACHE_TAGS.post(slug))
  }
}

/**
 * Resolve tag names to rows, creating what does not exist.
 *
 * Matching is on the slug, which is what makes it case- and punctuation-
 * insensitive: "Next.js", "next.js" and "NEXT JS" all slugify to `next-js` and
 * resolve to one row rather than three (PRD US-3.5).
 */
async function resolveTags(names: string[]): Promise<string[]> {
  const db = getDb()
  if (!db || names.length === 0) return []

  const wanted = new Map<string, string>()
  for (const name of names) {
    const slug = slugify(name)
    // First spelling wins, so the display name is the one the author typed.
    if (slug && !wanted.has(slug)) wanted.set(slug, name.trim())
  }

  if (wanted.size === 0) return []

  await db
    .insert(schema.tags)
    .values([...wanted].map(([slug, name]) => ({ slug, name })))
    .onConflictDoNothing({ target: schema.tags.slug })

  const rows = await db
    .select({ id: schema.tags.id })
    .from(schema.tags)
    .where(inArray(schema.tags.slug, [...wanted.keys()]))

  return rows.map((row) => row.id)
}

/**
 * Replace a post's tag joins.
 *
 * Only the join rows are touched. A tag removed from this post survives for every
 * other post carrying it, which is the difference between un-tagging and deleting
 * a tag (PRD US-3.5).
 */
async function setPostTags(postId: string, names: string[]) {
  const db = getDb()
  if (!db) return

  const tagIds = await resolveTags(names)

  await db.delete(schema.postTags).where(eq(schema.postTags.postId, postId))

  if (tagIds.length > 0) {
    await db
      .insert(schema.postTags)
      .values(tagIds.map((tagId) => ({ postId, tagId })))
      .onConflictDoNothing()
  }
}

/**
 * Resolve a series title to a row, creating it if it is new.
 *
 * Matched on the slug for the same reason tags are: "Building a Blog" and
 * "building a blog" are one series, not two, and an author who retypes the title
 * slightly on part five should not silently start a second one.
 *
 * A description is only written when given, so re-saving part five with the box
 * empty does not erase the description entered on part one.
 */
async function resolveSeries(
  title: string | undefined,
  description: string | undefined
): Promise<string | null> {
  const db = getDb()
  if (!db || !title?.trim()) return null

  const slug = slugify(title)
  if (!slug) return null

  await db
    .insert(schema.series)
    .values({ slug, title: title.trim(), description: description?.trim() || null })
    .onConflictDoNothing({ target: schema.series.slug })

  const [row] = await db
    .select({ id: schema.series.id })
    .from(schema.series)
    .where(eq(schema.series.slug, slug))
    .limit(1)

  if (row && description?.trim()) {
    await db
      .update(schema.series)
      .set({ description: description.trim(), updatedAt: new Date() })
      .where(eq(schema.series.id, row.id))
  }

  return row?.id ?? null
}

/**
 * What a save accepts.
 *
 * `status` is the domain union rather than a bare string, so a caller cannot
 * offer a value the schema will then reject at runtime - the form's `<select>` is
 * built from the same list. Not derived wholesale from the Zod schema because
 * that types the body as `{ type: "doc" }` exactly, which is narrower than the
 * document a caller holds; validation still narrows it on the way through.
 */
interface SavePayload {
  id?: string
  title: string
  slug?: string
  excerpt?: string
  content: PostDocument
  coverUrl?: string
  coverAlt?: string
  status: PostStatus
  tags: string[]
  seriesTitle?: string
  seriesDescription?: string
  seriesOrder?: number
}

export async function savePost(payload: SavePayload): Promise<ActionResult> {
  await requireAuthor()

  const db = getDb()
  if (!db) return failure("No database is configured for this deployment.")

  if (payload.id && !postIdSchema.safeParse(payload.id).success) {
    return failure("That post no longer exists.")
  }

  const parsed = postInputSchema.safeParse(payload)
  if (!parsed.success) {
    // Field-level, so the form can put each message beside the input that caused
    // it rather than dumping one line at the top.
    return failure("That could not be saved.", parsed.error.flatten().fieldErrors)
  }

  const input = parsed.data
  const existing = payload.id
    ? await db.select().from(schema.posts).where(eq(schema.posts.id, payload.id)).limit(1)
    : []
  const current = existing[0]

  if (payload.id && !current) return failure("That post no longer exists.")

  // A slug the author typed is taken as given, subject to the pattern the schema
  // already enforced. One that was not is derived from the title, and de-duplicated
  // against every other post - not against this one, or renaming nothing would
  // append a suffix (PRD US-3.1).
  let slug = input.slug ?? slugify(input.title)

  if (!input.slug) {
    const others = await db
      .select({ slug: schema.posts.slug })
      .from(schema.posts)
      .where(current ? ne(schema.posts.id, current.id) : undefined)

    slug = uniqueSlug(
      input.title,
      others.map((row) => row.slug)
    )
  } else {
    const clash = await db
      .select({ id: schema.posts.id })
      .from(schema.posts)
      .where(
        current
          ? and(eq(schema.posts.slug, slug), ne(schema.posts.id, current.id))
          : eq(schema.posts.slug, slug)
      )
      .limit(1)

    if (clash.length > 0) {
      return failure("That could not be saved.", { slug: ["Another post already uses this slug."] })
    }
  }

  // From the payload rather than the parse result: the Zod schema validates the
  // body structurally and widens it, while the caller's type already says what it
  // is. Same object either way.
  const document = payload.content
  const text = plainText(document)

  if (text.length === 0) {
    return failure("That could not be saved.", { content: ["An article needs a body."] })
  }

  const shouldBePublished = input.status === "published"
  const publishedAt = shouldBePublished
    ? // Preserved across an unpublish and republish, so a post keeps the date it
      // was first put in front of readers rather than the date it came back
      // (PRD US-3.4).
      (current?.publishedAt ?? new Date())
    : (current?.publishedAt ?? null)

  // Resolved before the write, so a save that would create a series but then fail
  // on a slug clash has already been turned away above.
  const seriesId = await resolveSeries(input.seriesTitle, input.seriesDescription)

  const row = {
    slug,
    title: input.title,
    excerpt: input.excerpt || deriveExcerpt(document),
    contentJson: document,
    coverUrl: input.coverUrl ?? null,
    coverAlt: input.coverAlt ?? null,
    status: input.status,
    publishedAt,
    // Both or neither. Clearing the series title has to clear the order too, or
    // the row keeps a position within a series it no longer belongs to.
    seriesId,
    seriesOrder: seriesId ? (input.seriesOrder ?? null) : null,
    // Computed, never accepted: it is a pure function of the body, so a submitted
    // value could only be a duplicate or a lie (PRD US-3.1).
    readingTime: computeReadingTime(text),
    // Server clocks only. `createdAt` is untouched by design.
    updatedAt: new Date(),
  }

  let saved: { id: string; slug: string }

  try {
    const [written] = current
      ? await db
          .update(schema.posts)
          .set(row)
          .where(eq(schema.posts.id, current.id))
          .returning({ id: schema.posts.id, slug: schema.posts.slug })
      : await db
          .insert(schema.posts)
          .values(row)
          .returning({ id: schema.posts.id, slug: schema.posts.slug })

    saved = written
  } catch (error) {
    if (!isSeriesOrderClash(error)) throw error

    return failure("That could not be saved.", {
      seriesOrder: [`Part ${input.seriesOrder} of that series already exists.`],
    })
  }

  await setPostTags(saved.id, input.tags)

  revalidatePost(saved.slug, current?.slug)

  return { ok: true, postId: saved.id }
}

export async function setPostStatus(id: string, status: string): Promise<ActionResult> {
  await requireAuthor()

  const db = getDb()
  if (!db) return failure("No database is configured for this deployment.")

  const parsed = postInputSchema.shape.status.safeParse(status)
  if (!parsed.success) return failure("That is not a status a post can have.")

  const [current] = await db.select().from(schema.posts).where(eq(schema.posts.id, id)).limit(1)
  if (!current) return failure("That post no longer exists.")

  if (parsed.data === "published" && !current.contentJson) {
    return failure("A post needs a body before it can be published.")
  }

  if (parsed.data === "published" && current.coverUrl && !current.coverAlt) {
    // An image nobody can see is worse than no image, and this is the last point
    // at which it is cheap to fix (PRD US-3.6).
    return failure("The cover image needs alt text before this can be published.")
  }

  await db
    .update(schema.posts)
    .set({
      status: parsed.data,
      publishedAt:
        parsed.data === "published" ? (current.publishedAt ?? new Date()) : current.publishedAt,
      updatedAt: new Date(),
    })
    .where(eq(schema.posts.id, id))

  revalidatePost(current.slug)

  return { ok: true, postId: id }
}

export async function deletePost(id: string): Promise<ActionResult> {
  await requireAuthor()

  const db = getDb()
  if (!db) return failure("No database is configured for this deployment.")

  // Parsed before it reaches a uuid comparison, or Postgres raises rather than
  // simply matching nothing.
  if (!postIdSchema.safeParse(id).success) return failure("That post no longer exists.")

  const [current] = await db.select().from(schema.posts).where(eq(schema.posts.id, id)).limit(1)
  if (!current) return failure("That post no longer exists.")

  // The join rows go with it: `post_tags.post_id` cascades, so this is one
  // statement rather than two that could half-succeed. The tags themselves stay.
  await db.delete(schema.posts).where(eq(schema.posts.id, id))

  revalidatePost(current.slug)

  return { ok: true }
}

/**
 * A time-limited link that makes one unpublished post readable.
 *
 * Behind `requireAuthor` like every other action here: minting a token is exactly
 * the ability to publish a draft to whoever holds the link, so it is not a read.
 *
 * The token names this slug and nothing else, so it cannot be repointed at
 * another draft, and it expires on its own rather than needing to be revoked
 * (PRD US-3.3).
 */
export async function createPreviewLink(id: string): Promise<ActionResult & { url?: string }> {
  await requireAuthor()

  const db = getDb()
  if (!db) return failure("No database is configured for this deployment.")

  // Parsed before it reaches a uuid comparison, or Postgres raises rather than
  // simply matching nothing.
  if (!postIdSchema.safeParse(id).success) return failure("That post no longer exists.")

  const [current] = await db.select().from(schema.posts).where(eq(schema.posts.id, id)).limit(1)
  if (!current) return failure("That post no longer exists.")

  const token = await createPreviewToken(current.slug)

  return {
    ok: true,
    postId: id,
    url: `${BLOG_CONFIG.basePath}/${current.slug}/preview?token=${encodeURIComponent(token)}`,
  }
}
