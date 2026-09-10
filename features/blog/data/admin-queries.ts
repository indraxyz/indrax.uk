import "server-only"

import { desc, eq } from "drizzle-orm"

import type { AdminPost, AdminPostSummary } from "@/features/blog/types"
import { iso, tagsByPost } from "@/features/blog/data/queries"
import { requireAuthor } from "@/lib/auth-guard"
import { postIdSchema } from "@/lib/validators/blog"
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
    })
    .from(schema.posts)
    // Drafts have no publication date, so ordering by that would bury exactly the
    // posts an author is most likely to be working on.
    .orderBy(desc(schema.posts.updatedAt))

  const grouped = await tagsByPost(rows.map((row) => row.id))

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

  // A uuid column will not simply fail to match a non-uuid - it raises. Treating
  // a malformed id as "no such post" is what turns `/admin/edit/anything` from a
  // 500 into a 404.
  if (!postIdSchema.safeParse(id).success) return null

  const [row] = await db.select().from(schema.posts).where(eq(schema.posts.id, id)).limit(1)
  if (!row) return null

  const grouped = await tagsByPost([row.id])

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
    tags: grouped.get(row.id) ?? [],
  }
}
