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
 * published post with code blocks and every GFM construct, one published post
 * that shares a tag with it, one draft that must never appear anywhere public.
 */
import { eq, inArray } from "drizzle-orm"

import { computeReadingTime } from "@/features/blog/utils/reading-time"
import { deriveExcerpt } from "@/features/blog/utils/markdown"
import { slugify } from "@/features/blog/utils/slug"
import { getDb, schema } from "@/lib/db"
import { postInputSchema, type PostInput } from "@/lib/validators/blog"

import { loadLocalEnv } from "./dev-env"

loadLocalEnv()

const SEED: (PostInput & { publishedAt?: string })[] = [
  {
    title: "Rendering markdown without shipping a highlighter",
    slug: "rendering-markdown-without-shipping-a-highlighter",
    status: "published",
    publishedAt: "2026-08-14T09:00:00.000Z",
    tags: ["Next.js", "Performance", "TypeScript"],
    content: `Syntax highlighting is the easiest place on a blog to accidentally
ship a hundred kilobytes of JavaScript to a reader who only wanted to read a
paragraph. The usual setup runs a highlighter in the browser: the page arrives
with plain code in it, the bundle loads, and the code repaints. It works, and it
costs every reader the download.

## Move it to the server

The article body never changes between requests. That makes highlighting a build
concern, not a runtime one - so it belongs in the same pipeline that turns
markdown into HTML.

\`\`\`ts
const html = await unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeSanitize, schema)
  .use(rehypePrettyCode, { theme: { light: "github-light", dark: "github-dark" } })
  .use(rehypeStringify)
  .process(markdown)
\`\`\`

The reader gets HTML with the colours already in it. No highlighter reaches the
browser at all, which is the only reliable way to keep it out.

## Order is the security argument

Sanitising runs *before* the highlighter, not after. That ordering is not a
detail:

| Stage | Input | Trusted? |
| :--- | :--- | :--- |
| \`remarkParse\` | author's markdown | no |
| \`rehypeSanitize\` | parsed tree | no |
| \`rehypePrettyCode\` | sanitised tree | yes - we generated it |

Run them the other way around and the sanitiser strips the very attributes the
highlighter just added. Run them this way and untrusted input stays constrained
while our own output passes through untouched.

### Two themes, one pass

A dual theme emits both palettes as custom properties on the same markup:

\`\`\`css
.prose pre span {
  color: var(--shiki-light);
}

.dark .prose pre span {
  color: var(--shiki-dark);
}
\`\`\`

Switching theme repaints the code without a second render and without a byte of
JavaScript.

- [x] No client-side highlighter
- [x] Correct in both themes
- [ ] A copy button, eventually - which *will* cost a few bytes`,
  },
  {
    title: "A database that is allowed to be absent",
    slug: "a-database-that-is-allowed-to-be-absent",
    status: "published",
    publishedAt: "2026-08-28T09:00:00.000Z",
    tags: ["Architecture", "Postgres", "TypeScript"],
    content: `Adding a database to a site that did not have one usually means the
site now requires one. A fresh clone fails to build. CI fails to build. A preview
deployment that has not been handed a connection string fails to build. None of
that is inherent - it is just what happens when the client is constructed at
import time and throws when its configuration is missing.

## Make absence a state, not an error

\`\`\`ts
export function getDb(): Database | null {
  if (client) return client

  const url = process.env.DATABASE_URL
  if (!url) return null

  client = createClient(url)
  return client
}
\`\`\`

A null database is not a failure to handle. It is a database with nothing in it,
which is a state the application already has to render correctly - the empty
state on the first day, before anything is written.

## The same argument covers the failure case

If reading can return "nothing" when there is no database, it can return
"nothing" when the database is unreachable too:

> A blog that cannot reach Postgres renders as a blog with nothing in it. That is
> a far better failure than an unhandled exception taking down the only page the
> site has.

The error still gets logged, with enough context to find it. What changes is who
pays for it.

## What this is not

It is not a substitute for monitoring, and it deliberately hides a real problem
from the reader. That trade is only correct when the content is supplementary. On
a checkout page it would be indefensible.`,
  },
  {
    title: "Notes on preview tokens",
    slug: "notes-on-preview-tokens",
    status: "draft",
    tags: ["Security"],
    content: `This post is a draft and exists so the test suite has something that
must never be publicly reachable.

If you can read this at a public URL, something is wrong: drafts are expected to
404, and to be absent from the sitemap and the feed.`,
  },
]

async function main() {
  const db = getDb()

  if (!db) {
    throw new Error(
      "DATABASE_URL is not set. Run `npm run db:up` and copy .env.example to .env.local."
    )
  }

  // Validated with the same schema the authoring path will use, so a malformed
  // seed fails here rather than becoming a row nothing else can explain.
  const posts = SEED.map((entry) => ({
    ...postInputSchema.parse(entry),
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

  for (const post of posts) {
    const slug = post.slug ?? slugify(post.title)
    const row = {
      slug,
      title: post.title,
      excerpt: post.excerpt ?? deriveExcerpt(post.content),
      content: post.content,
      coverUrl: post.coverUrl ?? null,
      coverAlt: post.coverAlt ?? null,
      status: post.status,
      publishedAt: post.publishedAt,
      // Stored, never accepted from input - the same rule the authoring path
      // follows, exercised here so the seeded rows are honest.
      readingTime: computeReadingTime(post.content),
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
