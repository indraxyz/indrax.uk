import { relations } from "drizzle-orm"

import { POST_STATUSES, type PostDocument } from "@/features/blog/types"

// Better Auth owns these; the Drizzle adapter is handed the whole schema object,
// so they have to be reachable from here.
export * from "./auth-schema"
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

/**
 * `archived` is distinct from `draft`: a draft has never been public, an archived
 * post was and no longer is. Both 404 publicly, but only the second one needs its
 * old URL kept out of the sitemap deliberately rather than incidentally.
 */
export const postStatus = pgEnum("post_status", POST_STATUSES)

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
    // The markdown column this replaced. Expand/contract: it is written by nothing
    // and read by nothing as of this release, and is dropped in the next one, so a
    // rollback to the previous deploy still finds the data it expects (PRD US-6.1).
    content: text("content"),
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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Every public read filters on status and orders by publication date. One
    // composite index serves the list, the tag pages, the feed and the sitemap.
    index("idx_posts_status_published").on(table.status, table.publishedAt.desc()),
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

export const postsRelations = relations(posts, ({ many }) => ({
  postTags: many(postTags),
}))

export const tagsRelations = relations(tags, ({ many }) => ({
  postTags: many(postTags),
}))

export const postTagsRelations = relations(postTags, ({ one }) => ({
  post: one(posts, { fields: [postTags.postId], references: [posts.id] }),
  tag: one(tags, { fields: [postTags.tagId], references: [tags.id] }),
}))
