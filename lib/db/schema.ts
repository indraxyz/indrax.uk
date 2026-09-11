import { relations, sql } from "drizzle-orm"

import { POST_STATUSES, type PostDocument } from "@/features/blog/types"

// Better Auth owns these; the Drizzle adapter is handed the whole schema object,
// so they have to be reachable from here.
export * from "./auth-schema"
import {
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"

/**
 * Postgres' full-text type. Drizzle has no built-in for it.
 *
 * Never selected and never written - the column below is generated, so Postgres
 * owns its contents entirely. It exists in the schema only so the index and the
 * `@@` operator have something to name.
 */
const tsvector = customType<{ data: string; driverData: string }>({
  dataType: () => "tsvector",
})

/**
 * `archived` is distinct from `draft`: a draft has never been public, an archived
 * post was and no longer is. Both 404 publicly, but only the second one needs its
 * old URL kept out of the sitemap deliberately rather than incidentally.
 */
export const postStatus = pgEnum("post_status", POST_STATUSES)

/**
 * An ordered run of posts meant to be read in sequence.
 *
 * Its own table rather than a string on `posts`, because a series has a name and
 * a description that belong in one place: spelled across rows they drift, and
 * renaming one becomes an update of every member. The ordering lives on the post
 * (`seriesOrder`), since that is what changes when parts are reshuffled.
 */
export const series = pgTable("series", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  // Shown on the series page under the title. Optional: a series of two is often
  // self-explanatory from its parts.
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export const posts = pgTable(
  "posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    excerpt: text("excerpt"),
    // The article body, as the editor's own ProseMirror document.
    //
    // Untrusted for as long as it lives: the renderer emits whatever attributes
    // this carries, so sanitising happens on the way out, every time. Its meaning
    // depends on `BLOG_EXTENSIONS` - see the note there.
    contentJson: jsonb("content_json").$type<PostDocument>(),
    coverUrl: text("cover_url"),
    coverAlt: text("cover_alt"),
    status: postStatus("status").notNull().default("draft"),
    // Null until first publish, and preserved across an unpublish/republish cycle
    // so a post keeps the date it was actually first put in front of readers.
    publishedAt: timestamp("published_at", { withTimezone: true }),
    // Minutes. Computed and stored on write rather than derived on read: it is a
    // pure function of content, and a list page must not select `content`.
    readingTime: integer("reading_time"),
    viewCount: integer("view_count").notNull().default(0),
    // Null for a standalone post, which is most of them.
    seriesId: uuid("series_id").references(() => series.id, { onDelete: "set null" }),
    // Position within the series, 1-based. Ordered by this rather than by
    // publication date: parts are often written out of order, and a series is a
    // reading order, not a timeline.
    seriesOrder: integer("series_order"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    /**
     * What search searches.
     *
     * Generated rather than maintained by the application. A column the write
     * path has to remember to update is a column that goes stale the first time
     * someone edits a row from anywhere else - psql, a migration, a future admin
     * - and stale search results are the kind of bug nobody reports.
     *
     * `jsonb_path_query_array($.**.text)` pulls out the text nodes and only the
     * text nodes. Indexing the document wholesale would index its structure:
     * every `href` an article links to (so an injected spam link becomes a search
     * term), every code block's language, and the node type names themselves - a
     * search for "paragraph" would match everything ever written. Verified
     * against all four before settling on it.
     *
     * Weighted so a word in the title outranks the same word buried in the body.
     * `to_tsvector` is only IMMUTABLE in its two-argument form, which is why the
     * configuration is named explicitly rather than left to `default_text_search_config`.
     */
    searchVector: tsvector("search_vector").generatedAlwaysAs(
      sql`setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
          setweight(to_tsvector('english', coalesce(excerpt, '')), 'B') ||
          setweight(to_tsvector('english', coalesce(jsonb_path_query_array(content_json, '$.**.text')::text, '')), 'C')`
    ),
  },
  (table) => [
    // Every public read filters on status and orders by publication date. One
    // composite index serves the list, the tag pages, the feed and the sitemap.
    index("idx_posts_status_published").on(table.status, table.publishedAt.desc()),
    // GIN is the index for `@@`. Without it every search is a sequential scan
    // over every row's vector, which is fine at three posts and not at three
    // hundred.
    index("idx_posts_search").using("gin", table.searchVector),
    // Reading a series in order, which is the only way it is ever read.
    index("idx_posts_series").on(table.seriesId, table.seriesOrder),
    // Two parts cannot claim the same position. Partial, because `null` means
    // "not in a series" and any number of posts may be that.
    uniqueIndex("idx_posts_series_order_unique")
      .on(table.seriesId, table.seriesOrder)
      .where(sql`${table.seriesId} is not null`),
  ]
)

export const tags = pgTable("tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  // The unique key, and what a URL carries. Names are normalised into this, so
  // "Next.js" and "next.js" resolve to one row rather than two.
  slug: text("slug").notNull().unique(),
})

export const postTags = pgTable(
  "post_tags",
  {
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.postId, table.tagId] }),
    // The composite primary key already indexes `post_id` first, so looking a tag
    // up across posts - which is what a tag page does - needs its own index.
    index("idx_post_tags_tag").on(table.tagId),
  ]
)

export const postsRelations = relations(posts, ({ many, one }) => ({
  postTags: many(postTags),
  series: one(series, { fields: [posts.seriesId], references: [series.id] }),
}))

export const seriesRelations = relations(series, ({ many }) => ({
  posts: many(posts),
}))

export const tagsRelations = relations(tags, ({ many }) => ({
  postTags: many(postTags),
}))

export const postTagsRelations = relations(postTags, ({ one }) => ({
  post: one(posts, { fields: [postTags.postId], references: [posts.id] }),
  tag: one(tags, { fields: [postTags.tagId], references: [tags.id] }),
}))
