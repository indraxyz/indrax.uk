import { and, eq, inArray, ne, notInArray, sql } from "drizzle-orm"
import { invalidateTags } from "@/lib/cache.server"

import { WRITING_CONFIG } from "@/features/writing/config"
import { CACHE_TAGS } from "@/features/writing/data/queries"
import type { ActionResult, PostDocument, PostStatus } from "@/features/writing/types"
import { deriveExcerptText, plainText } from "@/features/writing/utils/plain-text"
import { computeReadingTime } from "@/features/writing/utils/reading-time"
import { createPreviewToken } from "@/features/writing/utils/preview-token"
import { slugify, uniqueSlug } from "@/features/writing/utils/slug"
import { requireAuthor } from "@/lib/auth-guard"
import { isSeriesOrderClash } from "@/features/writing/data/db-errors"
import { getDb, schema } from "@/lib/db"
import { postIdSchema, postInputSchema } from "@/lib/validators/writing"

/**
 * Everything that writes a post.
 *
 * Two rules hold across all of them, and neither is delegated upwards.
 *
 * **Authorisation is re-checked here.** Each mutation starts with `requireAuthor()`
 * rather than trusting a client redirect or the API caller (threat T-3).
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
 * Invalidation completes before the response so the next read sees the save.
 */
async function revalidatePost(...slugs: (string | null | undefined)[]) {
  await invalidateTags(
    CACHE_TAGS.posts,
    ...new Set(slugs.filter((value): value is string => Boolean(value)).map(CACHE_TAGS.post))
  )
}

/**
 * Normalize desired tag names before synchronizing their joins.
 *
 * Matching is on the slug, which is what makes it case- and punctuation-
 * insensitive: "Next.js", "next.js" and "NEXT JS" all slugify to `next-js` and
 * resolve to one row rather than three (PRD US-3.5).
 */
function normalizedTags(names: string[]): Map<string, string> {
  const wanted = new Map<string, string>()
  for (const name of names) {
    const slug = slugify(name)
    // First spelling wins; existing tag display names are never overwritten.
    if (slug && !wanted.has(slug)) wanted.set(slug, name.trim())
  }
  return wanted
}

/**
 * Resolve a series title to a row, creating it if it is new.
 *
 * Matched on the slug for the same reason tags are: "Building This Site" and
 * "building this site" are one series, not two, and an author who retypes the title
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

  const nextDescription = description?.trim()
  const [row] = await db
    .insert(schema.series)
    .values({ slug, title: title.trim(), description: nextDescription || null })
    .onConflictDoUpdate({
      target: schema.series.slug,
      set: {
        // The original display title and a previously written description survive
        // a differently cased title or an empty description on another part.
        description: nextDescription || sql`${schema.series.description}`,
        updatedAt: nextDescription ? new Date() : sql`${schema.series.updatedAt}`,
      },
    })
    .returning({ id: schema.series.id })

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
    ? await db
        .select({
          id: schema.posts.id,
          slug: schema.posts.slug,
          publishedAt: schema.posts.publishedAt,
        })
        .from(schema.posts)
        .where(eq(schema.posts.id, payload.id))
        .limit(1)
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
  } else if (slug !== current?.slug) {
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
    excerpt: input.excerpt || deriveExcerptText(text),
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

  const postId = current?.id ?? crypto.randomUUID()
  const wanted = normalizedTags(input.tags)

  const writePost = current
    ? db
        .update(schema.posts)
        .set(row)
        .where(eq(schema.posts.id, current.id))
        .returning({ id: schema.posts.id, slug: schema.posts.slug })
    : db
        .insert(schema.posts)
        .values({ ...row, id: postId })
        .returning({ id: schema.posts.id, slug: schema.posts.slug })

  let saved: { id: string; slug: string }

  try {
    // The post UPDATE locks this row before synchronizing joins. Always perform
    // the tag synchronization inside the same transaction: comparing a prior
    // read could otherwise miss a concurrent save that changed its tags.
    // Existing desired joins survive; only undesired joins are deleted, and
    // ON CONFLICT leaves both original tag names and existing joins untouched.
    const removeJoins = db.delete(schema.postTags).where(
      wanted.size > 0
        ? and(
            eq(schema.postTags.postId, postId),
            notInArray(
              schema.postTags.tagId,
              db
                .select({ id: schema.tags.id })
                .from(schema.tags)
                .where(inArray(schema.tags.slug, [...wanted.keys()]))
            )
          )
        : eq(schema.postTags.postId, postId)
    )
    const [written] = await db.batch([
      writePost,
      ...(wanted.size > 0
        ? [
            db
              .insert(schema.tags)
              .values([...wanted].map(([tagSlug, name]) => ({ slug: tagSlug, name })))
              .onConflictDoNothing({ target: schema.tags.slug }),
          ]
        : []),
      removeJoins,
      ...(wanted.size > 0
        ? [
            db
              .insert(schema.postTags)
              .select(
                db
                  .select({
                    postId: sql<string>`${postId}::uuid`.as("post_id"),
                    tagId: schema.tags.id,
                  })
                  .from(schema.tags)
                  .where(inArray(schema.tags.slug, [...wanted.keys()]))
              )
              .onConflictDoNothing(),
          ]
        : []),
    ])
    saved = written[0]
  } catch (error) {
    // Individual Drizzle writes wrap the driver error; Neon batches expose it
    // directly. Both must produce the same actionable series-order validation.
    if (!isSeriesOrderClash(error)) throw error

    return failure("That could not be saved.", {
      seriesOrder: [`Part ${input.seriesOrder} of that series already exists.`],
    })
  }

  await revalidatePost(saved.slug, current?.slug)

  return { ok: true, postId: saved.id }
}

export async function setPostStatus(id: string, status: string): Promise<ActionResult> {
  await requireAuthor()

  const db = getDb()
  if (!db) return failure("No database is configured for this deployment.")

  if (!postIdSchema.safeParse(id).success) return failure("That post no longer exists.")

  const parsed = postInputSchema.shape.status.safeParse(status)
  if (!parsed.success) return failure("That is not a status a post can have.")

  const [current] = await db
    .select({
      slug: schema.posts.slug,
      publishedAt: schema.posts.publishedAt,
      hasContent: sql<boolean>`${schema.posts.contentJson} is not null`,
      coverUrl: schema.posts.coverUrl,
      coverAlt: schema.posts.coverAlt,
    })
    .from(schema.posts)
    .where(eq(schema.posts.id, id))
    .limit(1)
  if (!current) return failure("That post no longer exists.")

  if (parsed.data === "published" && !current.hasContent) {
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

  await revalidatePost(current.slug)

  return { ok: true, postId: id }
}

export async function deletePost(id: string): Promise<ActionResult> {
  await requireAuthor()

  const db = getDb()
  if (!db) return failure("No database is configured for this deployment.")

  // Parsed before it reaches a uuid comparison, or Postgres raises rather than
  // simply matching nothing.
  if (!postIdSchema.safeParse(id).success) return failure("That post no longer exists.")

  // RETURNING also detects a missing post. Cascading joins and the post delete
  // happen in one statement, without first downloading its article body.
  const [current] = await db
    .delete(schema.posts)
    .where(eq(schema.posts.id, id))
    .returning({ slug: schema.posts.slug })
  if (!current) return failure("That post no longer exists.")

  await revalidatePost(current.slug)

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

  const [current] = await db
    .select({ slug: schema.posts.slug })
    .from(schema.posts)
    .where(eq(schema.posts.id, id))
    .limit(1)
  if (!current) return failure("That post no longer exists.")

  const token = await createPreviewToken(current.slug)

  return {
    ok: true,
    postId: id,
    url: `${WRITING_CONFIG.basePath}/${current.slug}/preview?token=${encodeURIComponent(token)}`,
  }
}
