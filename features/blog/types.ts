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

/**
 * The statuses a post can hold, as one source.
 *
 * The Postgres enum and the Zod schema both read this array, so the three copies
 * that would otherwise exist - and the two that would silently disagree - are one.
 */
export const POST_STATUSES = ["draft", "published", "archived"] as const

export type PostStatus = (typeof POST_STATUSES)[number]

/** One entry in an article's table of contents. */
export interface TocEntry {
  id: string
  text: string
  level: 2 | 3
}

export interface RenderedArticle {
  html: string
  headings: TocEntry[]
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

/** An ordered run of posts meant to be read in sequence. */
export interface Series {
  id: string
  slug: string
  title: string
  description: string | null
}

/** One part of a series, as the series page and the article footer list it. */
export interface SeriesPart {
  slug: string
  title: string
  order: number
  /** False for a part that is written but not yet published. */
  published: boolean
}

/**
 * Where an article sits in its series, and what is on either side of it.
 *
 * `position` and `total` count published parts only, so a reader is never told
 * they are on "part 2 of 7" with five of them unreachable. That makes `position`
 * different from the post's stored `seriesOrder`, which is the author's ordering
 * and keeps its gaps.
 */
export interface SeriesContext {
  series: Series
  parts: SeriesPart[]
  position: number
  total: number
  previous: SeriesPart | null
  next: SeriesPart | null
}

/** One part as the series page lists it: enough to draw a row, no body. */
export interface SeriesPartDetail {
  slug: string
  title: string
  order: number
  excerpt: string | null
  readingTime: number | null
  publishedAt: string | null
}

/** A series and the parts of it a reader can actually open. */
export interface SeriesWithParts {
  series: Series
  parts: SeriesPartDetail[]
}

/** A post as an article page sees it. */
export interface Post extends PostSummary {
  content: PostDocument
  status: PostStatus
  // Decorative and best-effort, by design. Counted by an image request, so it is
  // trivially inflatable and is never used for ranking or billing.
  viewCount: number
  /** Null for a standalone post, which is most of them. */
  seriesContext: SeriesContext | null
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

/**
 * What a search asked for and what came back.
 *
 * `query` is echoed so the page can say what it searched for without re-reading
 * `searchParams`, and so a rejected query - too long, or nothing but punctuation
 * - is reported as the empty result it produced rather than as an error.
 */
export interface SearchResults {
  query: string
  posts: PostSummary[]
  page: number
  pageCount: number
}

/**
 * A post as the admin list sees it: every status, including the ones that 404
 * publicly.
 */
export interface AdminPostSummary {
  id: string
  slug: string
  title: string
  status: PostStatus
  publishedAt: string | null
  updatedAt: string
  tags: Tag[]
}

/** A post as the edit form sees it. */
export interface AdminPost extends AdminPostSummary {
  excerpt: string | null
  content: PostDocument | null
  coverUrl: string | null
  coverAlt: string | null
  // The title rather than the id, because the title is what the form's text box
  // holds and what `resolveSeries` matches on.
  seriesTitle: string | null
  seriesDescription: string | null
  seriesOrder: number | null
}

/**
 * What a mutating action tells its caller.
 *
 * `errors` is keyed by field name so a form can put each message beside the input
 * that caused it, rather than dumping one line at the top.
 */
export interface ActionResult {
  ok: boolean
  errors?: Record<string, string[]>
  message?: string
  postId?: string
}
