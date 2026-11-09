import { sql } from "drizzle-orm"
import type { Tag } from "@/features/writing/types"
import { schema } from "@/lib/db/index.server"
import { qualified } from "@/lib/db/qualified-column"

/** Correlated tags projection: one row per post, shared by public/admin reads and saves. */
export const postTagsProjection = sql<Tag[]>`coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', ${qualified(schema.tags.id)},
      'name', ${qualified(schema.tags.name)},
      'slug', ${qualified(schema.tags.slug)}
    ) order by ${qualified(schema.tags.name)})
    from ${schema.postTags}
    inner join ${schema.tags} on ${qualified(schema.tags.id)} = ${qualified(schema.postTags.tagId)}
    where ${qualified(schema.postTags.postId)} = ${qualified(schema.posts.id)}
  ), '[]'::jsonb)`.mapWith((value: Tag[] | string) =>
  typeof value === "string" ? (JSON.parse(value) as Tag[]) : value
)
