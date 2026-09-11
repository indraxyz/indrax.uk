export const BLOG_CONFIG = {
  title: "Writing",
  // Used as the feed title and in per-page metadata, so the blog names itself the
  // same way everywhere it is listed.
  feedTitle: "Indra Cahya Edytya - Writing",
  feedDescription:
    "Notes on building and operating software: TypeScript, React, backend APIs, cloud deployment, and agentic workflows.",
  basePath: "/blog",
  feedPath: "/rss.xml",
  viewPath: "/api/views",
  // Cards per list page. Small enough that page two is reachable early, which is
  // what makes the pagination crawlable rather than decorative.
  pageSize: 10,
  // Items in the feed. Fixed rather than "everything", so the feed does not grow
  // without bound as the archive does.
  feedSize: 20,
  // The highest page number a request may ask for.
  //
  // Not a display concern - a bound on the cache key space. The page number is an
  // argument to a cached query, so `?page=1` through `?page=1000000` are a million
  // distinct cache misses, each running two queries and each returning the same
  // clamped page one. Clamping inside the query is too late; it has to happen
  // before the value reaches the cache (threat T-11).
  maxPage: 1000,
  searchPath: "/blog/search",
  seriesPath: "/blog/series",
  /**
   * The longest query that will be run.
   *
   * Not a usability limit - nobody searches a blog with 120 characters. It bounds
   * the work a stranger can ask the database to do per request, and it is the
   * length at which `websearch_to_tsquery` stops being a search and starts being
   * a way to spend someone else's CPU (threat T-11).
   */
  maxQueryLength: 120,
  /** Results per search page. Matches the archive so the cards look the same. */
  searchPageSize: 10,
  /**
   * The highest search page a request may ask for.
   *
   * Lower than `maxPage` because a search that goes 20 pages deep has already
   * failed as a search. It bounds the offset, which is what makes a deep page
   * expensive.
   */
  maxSearchPage: 20,
} as const

// Section wording lives here for the same reason the resume's does: the list page,
// the feed and the homepage section all render it, and when each kept its own copy
// the three drifted apart.
export const SECTION_COPY = {
  blog: "Notes on building and operating software - what worked, what did not, and what the difference turned out to be.",
  writing: "Recent notes on engineering practice, architecture, and the tools in daily use.",
} as const

export const EMPTY_COPY = {
  blog: "Nothing published yet. The first article is being written - check back, or subscribe to the feed.",
  tag: (name: string) => `Nothing published under ${name} yet.`,
  // Two different empty states. Arriving at the search page has no result to
  // report; searching and finding nothing does, and saying which term failed is
  // the difference between a dead end and a second attempt.
  searchIdle: "Search the archive by title, summary or anything written in an article.",
  searchNoResults: (query: string) => `Nothing matches ${query}. Try a shorter or different term.`,
} as const

export const tagSubtitle = (name: string) => `Articles tagged ${name}.`

export const seriesSubtitle = (count: number) =>
  `${count} ${count === 1 ? "part" : "parts"}, meant to be read in order.`
