import { and, count, desc, eq, sql } from "drizzle-orm"

import type {
  AdminPost,
  AdminPostSummary,
  AdminArchiveResults,
  Tag,
  TagWithCount,
} from "@/features/writing/types"
import { archivePageLimit } from "@/features/writing/utils/archive-options"
import { WRITING_CONFIG } from "@/features/writing/config"
import {
  adminArchiveSearchParams,
  defaultAdminArchiveOptions,
  parseAdminArchiveOptions,
  type AdminArchiveOptions,
} from "@/features/writing/utils/admin-archive-options"
import { qualified } from "@/lib/db/qualified-column"
import { buildArchiveQuery } from "./archive-query"
import { iso } from "@/features/writing/data/queries"
import { requireAuthor } from "@/lib/auth-guard"
import { postIdSchema } from "@/lib/validators/writing"
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
 * None of these are persistently cached, because an author who
 * has just saved must see what they saved.
 */

/** Counts and the most recent draft, without loading the archive or its tags. */
export async function getAdminOverview() {
  await requireAuthor()

  const db = getDb()
  const empty = { total: 0, published: 0, drafts: 0, archived: 0, latestDraft: null }
  if (!db) return empty

  // Neon HTTP batches both independent reads in one transaction/request. The
  // database does the counting and returns only the draft displayed on this page.
  const [counts, drafts] = await db.batch([
    db
      .select({
        total: count(),
        published:
          sql<number>`count(*) filter (where ${schema.posts.status} = 'published')`.mapWith(Number),
        drafts: sql<number>`count(*) filter (where ${schema.posts.status} = 'draft')`.mapWith(
          Number
        ),
        archived: sql<number>`count(*) filter (where ${schema.posts.status} = 'archived')`.mapWith(
          Number
        ),
      })
      .from(schema.posts),
    db
      .select({ id: schema.posts.id, title: schema.posts.title })
      .from(schema.posts)
      .where(eq(schema.posts.status, "draft"))
      .orderBy(desc(schema.posts.updatedAt))
      .limit(1),
  ])

  return { ...(counts[0] ?? empty), latestDraft: drafts[0] ?? null }
}

/** Every post, whatever its status, newest activity first. */
export async function listAllPosts(): Promise<AdminPostSummary[]> {
  await requireAuthor()

  const db = getDb()
  if (!db) return []

  // Existing Drizzle relations produce one SQL request, including each post's
  // tags. Never select article bodies for the admin list.
  const rows = await db.query.posts.findMany({
    columns: {
      id: true,
      slug: true,
      title: true,
      status: true,
      publishedAt: true,
      updatedAt: true,
    },
    with: {
      postTags: { columns: {}, with: { tag: true } },
    },
    // Drafts have no publication date; show the most recently edited first.
    orderBy: desc(schema.posts.updatedAt),
  })

  return rows.map(({ postTags, ...row }) => ({
    ...row,
    publishedAt: iso(row.publishedAt),
    updatedAt: row.updatedAt.toISOString(),
    tags: postTags.map(({ tag }) => tag).sort((a, b) => a.name.localeCompare(b.name)),
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

  const row = await db.query.posts.findFirst({
    columns: {
      id: true,
      slug: true,
      title: true,
      status: true,
      excerpt: true,
      contentJson: true,
      coverUrl: true,
      coverAlt: true,
      publishedAt: true,
      updatedAt: true,
      seriesOrder: true,
    },
    where: eq(schema.posts.id, id),
    with: {
      postTags: { columns: {}, with: { tag: true } },
      series: { columns: { title: true, description: true } },
    },
  })
  if (!row) return null

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
    tags: row.postTags.map(({ tag }) => tag).sort((a, b) => a.name.localeCompare(b.name)),
    seriesTitle: row.series?.title ?? null,
    seriesDescription: row.series?.description ?? null,
    seriesOrder: row.seriesOrder,
  }
}

/** Author-only archive, sharing filter semantics while retaining every publication status. */
export async function getAdminArchivePosts(
  input: AdminArchiveOptions = defaultAdminArchiveOptions
): Promise<AdminArchiveResults> {
  await requireAuthor()
  const db = getDb()
  if (!db) return { posts: [], total: 0, page: 1, pageCount: 0 }
  const options = parseAdminArchiveOptions(adminArchiveSearchParams(input))
  const criteria = buildArchiveQuery(options)
  const filter = and(
    criteria.filter,
    options.status === "any" ? undefined : eq(schema.posts.status, options.status)
  )
  const cards = (page: number) =>
    db
      .select({
        id: schema.posts.id,
        slug: schema.posts.slug,
        title: schema.posts.title,
        status: schema.posts.status,
        publishedAt: schema.posts.publishedAt,
        updatedAt: schema.posts.updatedAt,
        tags: sql<Tag[]>`coalesce((
      select jsonb_agg(jsonb_build_object('id', ${qualified(schema.tags.id)}, 'name', ${qualified(schema.tags.name)}, 'slug', ${qualified(schema.tags.slug)}) order by ${qualified(schema.tags.name)})
      from ${schema.postTags}
      inner join ${schema.tags} on ${qualified(schema.tags.id)} = ${qualified(schema.postTags.tagId)}
      where ${qualified(schema.postTags.postId)} = ${qualified(schema.posts.id)}
    ), '[]'::jsonb)`.mapWith((value: Tag[] | string) =>
          typeof value === "string" ? (JSON.parse(value) as Tag[]) : value
        ),
      })
      .from(schema.posts)
      .where(filter)
      .orderBy(...criteria.order)
      .limit(WRITING_CONFIG.pageSize)
      .offset((page - 1) * WRITING_CONFIG.pageSize)
  const [totals, initialRows] = await db.batch([
    db.select({ total: count() }).from(schema.posts).where(filter),
    cards(options.page),
  ])
  const total = totals[0].total
  const pageCount = Math.min(
    Math.ceil(total / WRITING_CONFIG.pageSize),
    archivePageLimit(options.q)
  )
  const page = Math.min(options.page, Math.max(1, pageCount))
  const rows = page === options.page || pageCount === 0 ? initialRows : await cards(page)
  return {
    total,
    page,
    pageCount,
    posts: rows.map((row) => ({
      ...row,
      publishedAt: iso(row.publishedAt),
      updatedAt: row.updatedAt.toISOString(),
    })),
  }
}

/** Badge counts include drafts and archived posts, and are available only to the author. */
export async function getAdminTagsInUse(): Promise<TagWithCount[]> {
  await requireAuthor()
  const db = getDb()
  if (!db) return []
  return db
    .select({
      id: schema.tags.id,
      name: schema.tags.name,
      slug: schema.tags.slug,
      postCount: count(schema.postTags.postId),
    })
    .from(schema.tags)
    .innerJoin(schema.postTags, eq(schema.postTags.tagId, schema.tags.id))
    .groupBy(schema.tags.id, schema.tags.name, schema.tags.slug)
    .orderBy(schema.tags.name)
}
