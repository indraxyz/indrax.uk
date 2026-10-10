import { and, asc, desc, gt, gte, lt, lte, sql, type SQL } from "drizzle-orm"
import type { ArchiveOptions } from "@/features/writing/utils/archive-options"
import * as schema from "@/lib/db/schema"
import { qualified } from "@/lib/db/qualified-column"

/** Shared criteria only. Each caller must independently enforce its visibility/auth boundary. */
export function buildArchiveQuery(options: ArchiveOptions): {
  filter: SQL | undefined
  order: SQL[]
} {
  const filters: (SQL | undefined)[] = []
  const tsquery = sql`websearch_to_tsquery('english', ${options.q})`
  if (options.q) filters.push(sql`${schema.posts.searchVector} @@ ${tsquery}`)
  if (options.tags.length)
    filters.push(sql`exists (
    select 1 from ${schema.postTags}
    inner join ${schema.tags} on ${qualified(schema.tags.id)} = ${qualified(schema.postTags.tagId)}
    where ${qualified(schema.postTags.postId)} = ${qualified(schema.posts.id)}
      and ${qualified(schema.tags.slug)} in (${sql.join(
        options.tags.map((tag) => sql`${tag}`),
        sql`, `
      )})
  )`)
  if (options.date === "custom") {
    if (options.from)
      filters.push(gte(schema.posts.publishedAt, new Date(`${options.from}T00:00:00Z`)))
    // Exclusive next midnight makes the end date inclusive without losing sub-second values.
    if (options.to)
      filters.push(
        lt(schema.posts.publishedAt, new Date(Date.parse(`${options.to}T00:00:00Z`) + 86_400_000))
      )
  } else if (options.date !== "any") {
    const now = new Date(Date.now())
    if (options.date === "year") {
      const year = now.getUTCFullYear()
      filters.push(gte(schema.posts.publishedAt, new Date(Date.UTC(year, 0, 1))))
      filters.push(lt(schema.posts.publishedAt, new Date(Date.UTC(year + 1, 0, 1))))
    } else {
      const days = options.date === "7d" ? 7 : 30
      filters.push(gte(schema.posts.publishedAt, new Date(now.getTime() - days * 86_400_000)))
      filters.push(lte(schema.posts.publishedAt, now))
    }
  }
  if (options.duration === "short") filters.push(lt(schema.posts.readingTime, 5))
  if (options.duration === "medium")
    filters.push(and(gte(schema.posts.readingTime, 5), lte(schema.posts.readingTime, 10)))
  if (options.duration === "long") filters.push(gt(schema.posts.readingTime, 10))
  const newest = sql`${schema.posts.publishedAt} desc nulls last`
  const order: SQL[] =
    options.sort === "oldest"
      ? [sql`${schema.posts.publishedAt} asc nulls last`]
      : options.sort === "views"
        ? [desc(schema.posts.viewCount), newest]
        : options.sort === "updated"
          ? [desc(schema.posts.updatedAt), newest]
          : options.sort === "title-asc"
            ? [sql`lower(${schema.posts.title}) asc`, newest]
            : options.sort === "title-desc"
              ? [sql`lower(${schema.posts.title}) desc`, newest]
              : options.sort === "relevance" && options.q
                ? [sql`ts_rank_cd(${schema.posts.searchVector}, ${tsquery}) desc`, newest]
                : [newest]
  order.push(asc(schema.posts.id))
  return { filter: and(...filters), order }
}
