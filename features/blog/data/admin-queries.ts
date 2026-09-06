import "server-only"

import { desc, eq, inArray } from "drizzle-orm"

import type { PostDocument, PostStatus, Tag } from "@/features/blog/types"
import { requireAuthor } from "@/lib/auth-guard"
import { getDb, schema } from "@/lib/db"

/**
 * Reads for the admin, kept apart from `queries.ts`.
 *
 * Everything in the public read layer filters on `isPublic`, and nothing there
 * can return a draft. These deliberately can - which is exactly why they live in
 * their own file, behind their own guard, rather than as an option on a shared
 * function. A boolean flag that switches a query between "public" and "everything"
 * is one wrong argument away from a leak; two functions are not.
 *
 * None of these are cached. The admin is `force-dynamic` because an author who
 * has just saved must see what they saved.
 */

export interface AdminPostSummary {
  id: string
  slug: string
  title: string
  status: PostStatus
  publishedAt: string | null
  updatedAt: string
  readingTime: number | null
  tags: Tag[]
}

export interface AdminPost extends AdminPostSummary {
  excerpt: string | null
  content: PostDocument | null
  coverUrl: string | null
  coverAlt: string | null
}

const iso = (value: Date | null) => (value ? value.toISOString() : null)

async function tagsFor(postIds: string[]): Promise<Map<string, Tag[]>> {
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

/** Every post, whatever its status, newest activity first. */
export async function listAllPosts(): Promise<AdminPostSummary[]> {
  await requireAuthor()

  const db = getDb()
  if (!db) return []

  const rows = await db
    .select({
      id: schema.posts.id,
      slug: schema.posts.slug,
      title: schema.posts.title,
      status: schema.posts.status,
      publishedAt: schema.posts.publishedAt,
      updatedAt: schema.posts.updatedAt,
      readingTime: schema.posts.readingTime,
    })
    .from(schema.posts)
    // Drafts have no publication date, so ordering by that would bury exactly the
    // posts an author is most likely to be working on.
    .orderBy(desc(schema.posts.updatedAt))

  const grouped = await tagsFor(rows.map((row) => row.id))

  return rows.map((row) => ({
    ...row,
    publishedAt: iso(row.publishedAt),
    updatedAt: row.updatedAt.toISOString(),
    tags: grouped.get(row.id) ?? [],
  }))
}

/** One post by id, for the edit form. */
export async function getPostForEdit(id: string): Promise<AdminPost | null> {
  await requireAuthor()

  const db = getDb()
  if (!db) return null

  const [row] = await db.select().from(schema.posts).where(eq(schema.posts.id, id)).limit(1)
  if (!row) return null

  const grouped = await tagsFor([row.id])

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    status: row.status,
    excerpt: row.excerpt,
    content: row.contentJson,
    coverUrl: row.coverUrl,
    coverAlt: row.coverAlt,
    publishedAt: iso(row.publishedAt),
    updatedAt: row.updatedAt.toISOString(),
    readingTime: row.readingTime,
    tags: grouped.get(row.id) ?? [],
  }
}
