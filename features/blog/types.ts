/*
 * Dates cross this boundary as ISO-8601 strings, not `Date` objects.
 *
 * Two reasons, and both bite silently. `unstable_cache` round-trips its value
 * through a serialiser, so a cached `Date` comes back as a string with a `Date`
 * type on it - every call site then compiles but fails at runtime on the first
 * cache hit. And these objects cross the server/client boundary into components.
 * A string is the honest type for both, and `<time datetime>` wants one anyway.
 */
/**
 * A stored article body: the editor's ProseMirror document.
 *
 * Deliberately structural rather than an exhaustive union of the node types.
 * Enumerating them here would be a third copy of the schema - after
 * `BLOG_EXTENSIONS` and the editor itself - and the one most likely to drift,
 * since nothing would fail when it did. What the pipeline actually needs is the
 * shape every node shares.
 */
export interface PostDocument {
  type: string
  text?: string
  attrs?: Record<string, unknown>
  marks?: { type: string; attrs?: Record<string, unknown> }[]
  content?: PostDocument[]
}

export interface Tag {
  id: string
  name: string
  slug: string
}

/**
 * A post as a list page sees it: everything needed to draw a card, and nothing
 * more. `content` is deliberately absent - selecting a whole article body once
 * per card is the difference between a fast list and a slow one (PRD US-2.1).
 */
export interface PostSummary {
  id: string
  slug: string
  title: string
  excerpt: string | null
  coverUrl: string | null
  coverAlt: string | null
  publishedAt: string | null
  updatedAt: string
  readingTime: number | null
  tags: Tag[]
}

/** A post as an article page sees it. */
export interface Post extends PostSummary {
  content: PostDocument
}

export interface PaginatedPosts {
  posts: PostSummary[]
  page: number
  pageCount: number
}

/** A tag with the number of published posts carrying it. */
export interface TagWithCount extends Tag {
  postCount: number
}
