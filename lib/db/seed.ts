/**
 * Seeds the local database with enough content to develop and test against.
 *
 *   npm run db:up && npm run db:migrate && npm run db:seed
 *
 * Idempotent: posts are matched on slug and updated in place, so running it twice
 * changes nothing. It is destructive only in the narrow sense that it overwrites
 * the seeded rows themselves - it never truncates, so anything written by hand
 * alongside them survives.
 *
 * The set is chosen to exercise the read path rather than to read well: one
 * published post using every node type the renderer handles, one published post
 * that shares a tag with it, one draft that must never appear anywhere public.
 */
import { eq, inArray, sql } from "drizzle-orm"

import type { PostDocument } from "@/features/blog/types"
import { deriveExcerpt, plainText } from "@/features/blog/utils/content"
import { computeReadingTime } from "@/features/blog/utils/reading-time"
import { slugify } from "@/features/blog/utils/slug"
import { getDb, schema } from "@/lib/db"
import { postInputSchema, type PostInput } from "@/lib/validators/blog"

import { loadLocalEnv } from "./dev-env"

loadLocalEnv()

/*
 * Terse constructors for ProseMirror nodes.
 *
 * Authoring these documents as literals is unreadable at any length, and pulling
 * in a markdown-to-ProseMirror converter would add a dependency to make a
 * dev-only script shorter. These also serve as a compact statement of the node
 * shapes `BLOG_EXTENSIONS` produces.
 */
type Inline = PostDocument

const text = (value: string, ...marks: string[]): Inline => ({
  type: "text",
  text: value,
  ...(marks.length > 0 ? { marks: marks.map((type) => ({ type })) } : {}),
})

const link = (value: string, href: string): Inline => ({
  type: "text",
  text: value,
  marks: [{ type: "link", attrs: { href } }],
})

const p = (...content: Inline[]): PostDocument => ({ type: "paragraph", content })
const h = (level: 2 | 3 | 4, value: string): PostDocument => ({
  type: "heading",
  attrs: { level },
  content: [text(value)],
})
const code = (language: string, value: string): PostDocument => ({
  type: "codeBlock",
  attrs: { language },
  content: [text(value)],
})
const quote = (value: string): PostDocument => ({
  type: "blockquote",
  content: [p(text(value))],
})
const bullets = (...items: string[]): PostDocument => ({
  type: "bulletList",
  content: items.map((item) => ({ type: "listItem", content: [p(text(item))] })),
})
const tasks = (...items: [string, boolean][]): PostDocument => ({
  type: "taskList",
  content: items.map(([label, checked]) => ({
    type: "taskItem",
    attrs: { checked },
    content: [p(text(label))],
  })),
})
const cell = (kind: "tableHeader" | "tableCell", value: string): PostDocument => ({
  type: kind,
  attrs: { colspan: 1, rowspan: 1 },
  content: [p(text(value))],
})
const table = (head: string[], ...rows: string[][]): PostDocument => ({
  type: "table",
  content: [
    { type: "tableRow", content: head.map((value) => cell("tableHeader", value)) },
    ...rows.map((row) => ({
      type: "tableRow",
      content: row.map((value) => cell("tableCell", value)),
    })),
  ],
})
const doc = (...content: PostDocument[]): PostDocument => ({ type: "doc", content })

const SEED: (Omit<PostInput, "content"> & { content: PostDocument; publishedAt?: string })[] = [
  {
    title: "Rendering an article without shipping a renderer",
    slug: "rendering-an-article-without-shipping-a-renderer",
    status: "published",
    publishedAt: "2026-08-14T09:00:00.000Z",
    tags: ["Next.js", "Performance", "TypeScript"],
    seriesTitle: "Building this blog",
    seriesDescription:
      "How the blog you are reading was built, in the order the decisions were actually made.",
    seriesOrder: 1,
    content: doc(
      p(
        text(
          "Syntax highlighting is the easiest place on a blog to accidentally ship a hundred kilobytes of JavaScript to a reader who only wanted to read a paragraph. The usual setup runs a highlighter in the browser: the page arrives with plain code in it, the bundle loads, and the code repaints. It works, and it costs every reader the download."
        )
      ),
      h(2, "Move it to the server"),
      p(
        text(
          "The article body never changes between requests. That makes highlighting a build concern, not a runtime one - so it belongs in the same pipeline that turns the stored document into HTML."
        )
      ),
      code(
        "ts",
        `const html = renderToHTMLString({ content: document, extensions: BLOG_EXTENSIONS })

const file = await unified()
  .use(rehypeParse, { fragment: true })
  .use(rehypeSanitize, schema)
  .use(rehypePrettyCode, { theme: { light: "github-light-high-contrast", dark: "github-dark" } })
  .use(rehypeStringify)
  .process(html)`
      ),
      p(
        text(
          "The reader gets HTML with the colours already in it. No highlighter reaches the browser at all, which is the only reliable way to keep it out."
        )
      ),
      h(2, "Order is the security argument"),
      p(
        text("Sanitising runs "),
        text("before", "italic"),
        text(" the highlighter, not after. That ordering is not a detail:")
      ),
      table(
        ["Stage", "Input", "Trusted?"],
        ["renderToHTMLString", "the stored document", "no"],
        ["rehypeSanitize", "parsed tree", "no"],
        ["rehypePrettyCode", "sanitised tree", "yes - we generated it"]
      ),
      p(
        text(
          "Run them the other way around and the sanitiser strips the very attributes the highlighter just added. Run them this way and untrusted input stays constrained while our own output passes through untouched."
        )
      ),
      h(3, "Two themes, one pass"),
      p(text("A dual theme emits both palettes as custom properties on the same markup:")),
      code(
        "css",
        `.prose pre span {
  color: var(--shiki-light);
}

.dark .prose pre span {
  color: var(--shiki-dark);
}`
      ),
      p(
        text(
          "Switching theme repaints the code without a second render and without a byte of JavaScript."
        )
      ),
      tasks(
        ["No client-side highlighter", true],
        ["Correct in both themes", true],
        ["A copy button, eventually - which will cost a few bytes", false]
      )
    ),
  },
  {
    title: "A database that is allowed to be absent",
    slug: "a-database-that-is-allowed-to-be-absent",
    status: "published",
    publishedAt: "2026-08-28T09:00:00.000Z",
    tags: ["Architecture", "Postgres", "TypeScript"],
    seriesTitle: "Building this blog",
    seriesOrder: 2,
    content: doc(
      p(
        text(
          "Adding a database to a site that did not have one usually means the site now requires one. A fresh clone fails to build. CI fails to build. A preview deployment that has not been handed a connection string fails to build. None of that is inherent - it is just what happens when the client is constructed at import time and throws when its configuration is missing."
        )
      ),
      h(2, "Make absence a state, not an error"),
      code(
        "ts",
        `export function getDb(): Database | null {
  if (client) return client

  const url = process.env.DATABASE_URL
  if (!url) return null

  client = createClient(url)
  return client
}`
      ),
      p(
        text(
          "A null database is not a failure to handle. It is a database with nothing in it, which is a state the application already has to render correctly - the empty state on the first day, before anything is written."
        )
      ),
      h(2, "The same argument covers the failure case"),
      p(
        text("If reading can return "),
        text("nothing", "italic"),
        text(
          " when there is no database, it can return nothing when the database is unreachable too:"
        )
      ),
      quote(
        "A blog that cannot reach Postgres renders as a blog with nothing in it. That is a far better failure than an unhandled exception taking down the only page the site has."
      ),
      p(
        text(
          "The error still gets logged, with enough context to find it. What changes is who pays for it. There is one exception, and it matters: a single article that cannot be loaded answers 500, not 404, because a 404 tells a crawler it was deleted."
        )
      ),
      h(2, "What this is not"),
      bullets(
        "It is not a substitute for monitoring.",
        "It deliberately hides a real problem from the reader.",
        "On a checkout page it would be indefensible."
      ),
      p(
        text("The reasoning is written up in "),
        link("the implementation plan", "https://github.com/indraxyz/indrax.uk"),
        text(", alongside the rest of the branch.")
      )
    ),
  },
  {
    title: "Notes on preview tokens",
    slug: "notes-on-preview-tokens",
    status: "draft",
    tags: ["Security"],
    // Part three, and unpublished. Deliberate: it is what proves a reader is told
    // "part 1 of 2" rather than "part 1 of 3" with one of them answering 404.
    seriesTitle: "Building this blog",
    seriesOrder: 3,
    content: doc(
      p(
        text(
          "This post is a draft and exists so the test suite has something that must never be publicly reachable."
        )
      ),
      p(
        text(
          "If you can read this at a public URL, something is wrong: drafts are expected to 404, and to be absent from the sitemap and the feed."
        )
      )
    ),
  },
]

async function main() {
  const db = getDb()

  if (!db) {
    throw new Error(
      "DATABASE_URL is not set. Run `npm run db:up` and copy .env.example to .env.local."
    )
  }

  // Validated with the same schema the authoring path uses, so a malformed seed
  // fails here rather than becoming a row nothing else can explain.
  const posts = SEED.map((entry) => ({
    ...postInputSchema.parse(entry),
    content: entry.content,
    publishedAt: entry.publishedAt ? new Date(entry.publishedAt) : null,
  }))

  const tagNames = [...new Set(posts.flatMap((post) => post.tags))]
  const tagRows = tagNames.map((name) => ({ name, slug: slugify(name) }))

  if (tagRows.length > 0) {
    await db.insert(schema.tags).values(tagRows).onConflictDoNothing({ target: schema.tags.slug })
  }

  const existingTags = await db
    .select()
    .from(schema.tags)
    .where(
      inArray(
        schema.tags.slug,
        tagRows.map((tag) => tag.slug)
      )
    )
  const tagIdBySlug = new Map(existingTags.map((tag) => [tag.slug, tag.id]))

  // Series, resolved the same way tags are: matched on the slug, so one title
  // spelled two ways is still one row. The description is taken from whichever
  // entry supplies one.
  const seriesRows = [
    ...new Map(
      posts
        .filter((post) => post.seriesTitle)
        .map((post) => [
          slugify(post.seriesTitle as string),
          {
            slug: slugify(post.seriesTitle as string),
            title: (post.seriesTitle as string).trim(),
            description: post.seriesDescription?.trim() ?? null,
          },
        ])
    ).values(),
  ]

  if (seriesRows.length > 0) {
    await db
      .insert(schema.series)
      .values(seriesRows)
      .onConflictDoUpdate({
        target: schema.series.slug,
        set: { title: sql`excluded.title`, updatedAt: new Date() },
      })
  }

  const existingSeries = seriesRows.length
    ? await db
        .select()
        .from(schema.series)
        .where(
          inArray(
            schema.series.slug,
            seriesRows.map((row) => row.slug)
          )
        )
    : []
  const seriesIdBySlug = new Map(existingSeries.map((row) => [row.slug, row.id]))

  for (const post of posts) {
    const slug = post.slug ?? slugify(post.title)
    const row = {
      slug,
      title: post.title,
      excerpt: post.excerpt ?? deriveExcerpt(post.content),
      contentJson: post.content,
      coverUrl: post.coverUrl ?? null,
      coverAlt: post.coverAlt ?? null,
      status: post.status,
      publishedAt: post.publishedAt,
      // Stored, never accepted from input - the same rule the authoring path
      // follows, exercised here so the seeded rows are honest.
      readingTime: computeReadingTime(plainText(post.content)),
      seriesId: post.seriesTitle ? (seriesIdBySlug.get(slugify(post.seriesTitle)) ?? null) : null,
      seriesOrder: post.seriesTitle ? (post.seriesOrder ?? null) : null,
      updatedAt: new Date(),
    }

    const [saved] = await db
      .insert(schema.posts)
      .values(row)
      .onConflictDoUpdate({ target: schema.posts.slug, set: row })
      .returning({ id: schema.posts.id })

    // Replace the joins rather than merge them, so removing a tag from the seed
    // removes it from the row too.
    await db.delete(schema.postTags).where(eq(schema.postTags.postId, saved.id))

    const joins = post.tags
      .map((name) => tagIdBySlug.get(slugify(name)))
      .filter((id): id is string => Boolean(id))
      .map((tagId) => ({ postId: saved.id, tagId }))

    if (joins.length > 0) {
      await db.insert(schema.postTags).values(joins).onConflictDoNothing()
    }

    console.log(`  ${post.status.padEnd(9)} ${slug}`)
  }

  console.log(`\nSeeded ${posts.length} posts and ${tagRows.length} tags.`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
