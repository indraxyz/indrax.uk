# indrax.uk — Blog Feature Spec (v2, codebase-matched)

> **Repository copy.** This is the source technical spec for the blog feature.
> It was written against `555f5dd` and several of the open questions in §0 have
> since been resolved — see §1 of
> [`blog-implementation-plan.md`](./blog-implementation-plan.md), which also
> records the deploy-target decision §0 asks for and every place the built code
> departs from what is written here.

Revised against `github.com/indraxyz/indrax.uk` @ `555f5dd` (main, 31 Aug 2026).

---

## 0. What the codebase actually is

| Aspect          | Reality                                                                                       |
| --------------- | --------------------------------------------------------------------------------------------- |
| Framework       | Next.js **16.3.3**, App Router                                                                |
| React           | **19.2.8**                                                                                    |
| Styling         | Tailwind **v4** — CSS-first, `@theme` block in `app/globals.css`, **no `tailwind.config.js`** |
| UI              | shadcn/ui, `components.json` present, `rsc: true`                                             |
| Package manager | **npm 11.6.0** (not pnpm)                                                                     |
| Path alias      | `@/*` → `./*` (repo root, no `src/`)                                                          |
| Fonts           | JetBrains Mono for **both** `--font-sans` and `--font-mono`                                   |
| Architecture    | Feature-based: `features/resume/{components,data,utils,config.ts,types.ts}`                   |
| Design tokens   | 3-layer: `--primitive-*` → `--semantic-*` → `--component-*`, light + `.dark`                  |
| Tests           | **None.** Vitest/Playwright are on the ARCHITECTURE.md roadmap                                |
| Data            | Fully static — `features/resume/data/resume.ts`, no DB, no env beyond `NEXT_PUBLIC_SITE_URL`  |

### Three things to resolve before coding

1. **No Cloudflare adapter exists in the repo.** No `wrangler.toml`, no `@opennextjs/cloudflare`, no `@cloudflare/next-on-pages`. `.gitignore` still carries a `# vercel` / `.vercel` block, and the README references `indrax-nextjs-shadcn-vercel`. Everything here has been static so far, so it may be running on Cloudflare Pages' static/Next preset. **Adding a DB + auth means real server runtime.** Confirm the target before Phase 1 — it decides the driver and the deploy config (see §11).
2. **Deployed site is ahead of `main`.** Live meta shows `https://indrax.uk/opengraph-image?...` (file-based OG route), but `app/layout.tsx` on main still points OG at `/foto-profile.jpg`, and no `app/opengraph-image.tsx` exists in the repo. Reconcile before branching.
3. **The whole site is monospace.** Fine for a resume; poor for 2,000-word articles. See §5.

### Minor cleanup worth doing alongside

- `@radix-ui/*`, `@tailwindcss/postcss`, `tailwindcss` sit in `devDependencies` but are runtime/build-required. Works today because Next bundles them, but it will bite on any deploy target that prunes dev deps. Move to `dependencies`.

---

## 1. Stack additions

| Purpose         | Package                                           | Note                                       |
| --------------- | ------------------------------------------------- | ------------------------------------------ |
| DB              | Neon Postgres                                     | Platform-agnostic, portable                |
| Driver          | `@neondatabase/serverless`                        | HTTP-based; works on both Node and Workers |
| ORM             | `drizzle-orm`, `drizzle-kit`                      | `neon-http` adapter                        |
| Auth            | `better-auth`                                     | Drizzle adapter, GitHub OAuth              |
| Validation      | `zod`                                             | Shared client/server                       |
| Editor          | `@tiptap/react` + starter kit                     | Admin only, dynamically imported           |
| Markdown render | `react-markdown`, `remark-gfm`, `rehype-sanitize` |                                            |
| Highlighting    | `rehype-pretty-code` + `shiki`                    | Build/server-time, zero client JS          |
| Prose styling   | `@tailwindcss/typography`                         | Registered via `@plugin` — see §5          |
| Reading time    | `reading-time`                                    |                                            |

Install with `npm i`, not pnpm.

---

## 2. File structure (mirrors `features/resume/`)

```
app/
  blog/
    page.tsx                    -- list
    [slug]/
      page.tsx
      opengraph-image.tsx
    tag/[tag]/page.tsx
  admin/
    layout.tsx                  -- auth guard
    page.tsx
    new/page.tsx
    edit/[id]/page.tsx
    login/page.tsx
  api/
    auth/[...all]/route.ts
    upload/route.ts
  rss.xml/route.ts
  sitemap.ts                    -- MODIFY: becomes async

features/
  blog/
    components/
      post-card.tsx
      post-list-section.tsx
      post-content.tsx
      post-meta.tsx
      table-of-contents.tsx
      tag-pill.tsx
      admin/
        post-form.tsx
        editor.tsx              -- Tiptap, "use client", dynamic
        image-upload.tsx
    data/
      queries.ts                -- all Drizzle reads/writes
    utils/
      slug.ts
      markdown.ts
      reading-time.ts
    config.ts                   -- BLOG_CONFIG, SECTION_COPY.blog, page size
    types.ts                    -- Post, Tag, PostStatus, PostWithTags

lib/
  db/
    index.ts                    -- neon + drizzle client
    schema.ts
  auth.ts
  validators/blog.ts

drizzle/                        -- generated migrations
middleware.ts                   -- NEW: /admin/* guard
```

**Convention notes pulled from the existing code:**

- Kebab-case filenames, PascalCase component exports (`post-card.tsx` → `PostCard`)
- Named exports, no default exports outside `app/`
- Domain types in `features/blog/types.ts`, not colocated
- Copy strings in `config.ts` (the resume feature does this because page + PDF both render it — same discipline applies for blog list + RSS + OG)
- Import `cn` from `@/lib/utils` (barrel), not `@/lib/utils/cn`

---

## 3. Schema

`lib/db/schema.ts`:

```
postStatus  pgEnum('post_status', ['draft','published','archived'])

posts
  id            uuid pk defaultRandom
  slug          text unique not null
  title         text not null
  excerpt       text
  content       text not null          -- markdown source
  coverUrl      text
  coverAlt      text
  status        postStatus default 'draft' not null
  publishedAt   timestamptz
  readingTime   integer                -- minutes, computed on save
  viewCount     integer default 0 not null
  createdAt     timestamptz default now() not null
  updatedAt     timestamptz default now() not null

tags
  id            uuid pk defaultRandom
  name          text not null
  slug          text unique not null

postTags
  postId        uuid -> posts.id onDelete cascade
  tagId         uuid -> tags.id onDelete cascade
  pk (postId, tagId)
```

Better Auth generates `user`, `session`, `account`, `verification` via its Drizzle adapter — do not hand-write those.

### Indexes

```sql
create index idx_posts_status_published on posts(status, published_at desc);
create index idx_post_tags_tag on post_tags(tag_id);
```

### Phase 5 full-text

```sql
alter table posts add column search_vector tsvector
  generated always as (
    to_tsvector('english',
      coalesce(title,'') || ' ' || coalesce(excerpt,'') || ' ' || coalesce(content,''))
  ) stored;
create index idx_posts_search on posts using gin(search_vector);
```

---

## 4. Reusing the existing design system

**Do not introduce new colours.** The token pipeline is `--primitive-*` → `--semantic-*` → `--component-*` and both light and `.dark` blocks must stay in sync. Blog UI composes from what exists:

| Need                   | Reuse                                                                                                                       |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Section frame + header | `components/ui/section-card.tsx` — gives you the card, header bar, `card`/`ghost` variants, and scroll-region a11y for free |
| Tags                   | `components/ui/badge.tsx` with `VisualVariant`                                                                              |
| Post cards             | `components/ui/card.tsx`                                                                                                    |
| Tone prop              | `variantClassNames` from `components/ui/variants.ts`                                                                        |
| Class merging          | `cn` from `@/lib/utils`                                                                                                     |
| Dates                  | `lib/utils/date.ts`                                                                                                         |

If prose genuinely needs new tokens (code-block background, blockquote rule), add them at the **component layer** (`--component-prose-*`), define in both `:root` and `.dark`, and derive from existing semantics — never raw hex.

`SectionCard` accepts `carousel` for horizontal rails (the portfolio section uses it). A "Latest articles" strip on the homepage can reuse that directly.

---

## 5. Typography — the real problem

`--font-sans` and `--font-mono` both resolve to JetBrains Mono. Monospace at long-form reading lengths hurts scan speed and line economy badly.

**Recommendation:** add one variable text face scoped to article body only.

1. Load a second font in `app/layout.tsx` (e.g. `Inter` or `Source_Serif_4`) as `--font-prose`
2. Register it in the `@theme` block alongside `--font-sans`
3. Apply `font-[family-name:var(--font-prose)]` **only** inside `.prose` on `/blog/[slug]` — the resume, nav, headings, and all chrome stay monospace, preserving site identity
4. Keep `--font-mono` (JetBrains) for code blocks — it's genuinely good at that

Tailwind v4 has no config file, so the typography plugin registers in CSS:

```css
/* app/globals.css, near the top */
@import "tailwindcss";
@plugin "@tailwindcss/typography";
```

Then override prose colours to the semantic tokens so dark mode works without `prose-invert`:

```css
@layer base {
  .prose {
    --tw-prose-body: var(--semantic-text-secondary);
    --tw-prose-headings: var(--semantic-text-primary);
    --tw-prose-links: var(--semantic-action-secondary);
    --tw-prose-bold: var(--semantic-text-primary);
    --tw-prose-quotes: var(--semantic-text-primary);
    --tw-prose-code: var(--semantic-text-primary);
    --tw-prose-hr: var(--semantic-border-default);
    --tw-prose-quote-borders: var(--semantic-border-default);
  }
}
```

Because these point at semantics that already flip under `.dark`, dark mode needs no separate prose block.

**Also check:** `body` carries a grid-line `background-image`. Verify it doesn't fight long text columns — consider suppressing it behind the article container.

---

## 6. Files to modify (not create)

| File                        | Change                                                                                                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/sitemap.ts`            | Currently a static single-entry array. Make `async`, query published posts, append `/blog`, `/blog/[slug]`, tag pages. Keep `RESUME_CONFIG.updatedAt` for the root entry. |
| `app/globals.css`           | Add `@plugin "@tailwindcss/typography"`, `--font-prose` in `@theme`, prose token overrides, any `--component-prose-*`                                                     |
| `app/layout.tsx`            | Load prose font, add `--font-prose` variable to `<html>` className                                                                                                        |
| `features/resume/config.ts` | Add `blog` entry to `SOCIAL_LINKS`/nav if you surface a header link                                                                                                       |
| `package.json`              | New deps; move Radix + Tailwind out of `devDependencies`; add `db:generate`, `db:migrate`, `db:studio` scripts                                                            |
| `.gitignore`                | Add `.dev.vars` (Wrangler local secrets) if going Cloudflare                                                                                                              |
| `ARCHITECTURE.md`           | Document the `features/blog/` slice and the data-flow change (static file → DB)                                                                                           |
| `README.md`                 | Env var setup section                                                                                                                                                     |

`app/robots.ts` needs no change — `allow: "/"` already covers `/blog`. But **explicitly disallow `/admin`**.

---

## 7. Auth

GitHub OAuth only, single-user allow-list. No passwords — nothing to hash, rotate, reset, or leak.

- Provider: GitHub OAuth App, callback `https://indrax.uk/api/auth/callback/github`
- Adapter: Better Auth → Drizzle → the same Neon database
- Sessions: **DB-backed**, not stateless JWT — a DB session can be revoked instantly if you lose a device
- Cookies: `httpOnly`, `secure`, `sameSite=strict`; rotate token on login
- Expiry: 7d idle, 30d absolute
- Allow-list in the `signIn` callback: reject any GitHub ID ≠ `ALLOWED_GITHUB_ID`

**`middleware.ts` is a redirect, not an authorization boundary.** Re-verify the session inside every mutating server action.

---

## 8. Data flow (extends the ARCHITECTURE.md diagram)

```
Neon (source of truth)
    ↓  lib/db/schema.ts        -- Drizzle schema
    ↓  features/blog/data/queries.ts
    ↓  features/blog/types.ts
    ↓  app/blog/**             -- thin route entries
    ↓  features/blog/components/
    ↓  components/ui/          -- existing primitives
```

Same shape as the resume slice, with the static data file swapped for a query layer. Keep `app/blog/*` thin — the existing convention is that routes only compose.

---

## 9. Caching & revalidation

- Public blog pages static, invalidated by tag
- Tag every read: `'posts'` and `` `post:${slug}` ``
- Mutations call `revalidateTag` for both
- `/admin/*`: `export const dynamic = 'force-dynamic'`
- Neon cold start is ~500ms on resume from scale-to-zero; caching means readers essentially never pay it

---

## 10. Phases

### Phase 0 — Decide runtime

Resolve §0 items 1 and 2. Move Radix to `dependencies`. Nothing else starts until the deploy target is known.

### Phase 1 — Data layer

1. Neon project → copy **pooled** connection string
2. `npm i drizzle-orm @neondatabase/serverless && npm i -D drizzle-kit`
3. `lib/db/schema.ts`, `drizzle.config.ts`
4. `npx drizzle-kit generate` → `npx drizzle-kit migrate`
5. `lib/db/index.ts`:
   ```ts
   import { neon } from "@neondatabase/serverless"
   import { drizzle } from "drizzle-orm/neon-http"
   import * as schema from "./schema"

   export const db = drizzle(neon(process.env.DATABASE_URL!), { schema })
   ```
6. `features/blog/data/queries.ts` — `getPublishedPosts`, `getPostBySlug`, `getPostsByTag`, `getAllTags`, `createPost`, `updatePost`, `deletePost`
7. Seed 3 posts

**Done when:** queries return typed rows locally.

### Phase 2 — Public pages

1. `@plugin "@tailwindcss/typography"` + prose tokens + `--font-prose` (§5)
2. `/blog` list via `SectionCard` + `PostCard`
3. `/blog/[slug]` — `react-markdown` + `rehype-sanitize` + `rehype-pretty-code`
4. `/blog/tag/[tag]`
5. `generateMetadata` per post (title, description, canonical, OG, Twitter)
6. `Article` + `BreadcrumbList` JSON-LD
7. `app/blog/[slug]/opengraph-image.tsx` — match the brand palette
8. Make `app/sitemap.ts` async; add `app/rss.xml/route.ts`
9. Verify print styles don't break (`globals.css` has print rules)

**Done when:** posts render, dark mode correct, Lighthouse SEO ≥ 95.

### Phase 3 — Auth + admin

1. `npm i better-auth`, GitHub OAuth App
2. `lib/auth.ts` — Drizzle adapter, GitHub provider, DB sessions, allow-list
3. `middleware.ts` on `/admin/:path*`
4. `/admin` list, `/admin/new`, `/admin/edit/[id]`
5. Tiptap via `next/dynamic`, `ssr: false` — must stay out of the public bundle
6. Server actions, Zod-validated, session re-checked inside each
7. Cover upload (R2 presigned, or Vercel Blob if staying on Vercel)
8. `revalidateTag` after every mutation
9. Add `/admin` disallow to `app/robots.ts`

**Done when:** login → write → publish → live.

### Phase 4 — Polish

TOC from headings, reading time, related-by-tag, code copy button, signed draft preview, view counter.

### Phase 5 — Growth

Postgres full-text search → `pgvector` semantic search (a natural showcase for the AI/agentic work already on the resume), Giscus comments, series support.

---

## 11. Deployment

**If Cloudflare Workers:**

```
npm i -D @opennextjs/cloudflare wrangler
```

Add `wrangler.toml` + `open-next.config.ts`, set `nodejs_compat`, secrets via `wrangler secret put`. `@neondatabase/serverless` is already the correct driver — Workers cannot open raw TCP sockets, so `pg` will not work.

**If Vercel:** no adapter needed. Keep `@neondatabase/serverless` anyway; it's fast over HTTP and keeps the Cloudflare option open at zero cost.

Either way the app code is identical — that's the point of picking Neon over D1.

---

## 12. Environment

```
NEXT_PUBLIC_SITE_URL=https://indrax.uk   # exists
DATABASE_URL=                            # Neon pooled
BETTER_AUTH_SECRET=                      # openssl rand -base64 32
BETTER_AUTH_URL=https://indrax.uk
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
ALLOWED_GITHUB_ID=                       # your numeric GitHub user id
R2_ACCOUNT_ID= / R2_ACCESS_KEY_ID= / R2_SECRET_ACCESS_KEY= / R2_BUCKET= / R2_PUBLIC_URL=
```

`.gitignore` already covers `.env` and `.env*.local`. Add `.dev.vars` if using Wrangler.

---

## 13. Neon branching

One branch per preview deploy so schema changes never touch production data:

1. `neonctl branches create --name preview/<branch>`
2. Inject that branch's URL into the preview environment
3. Migrate + verify on the branch
4. Merge → migrate production → delete branch

This is the main reason to pick Neon over D1. Wire it up in Phase 1 — retrofitting it after there's real content is painful.

---

## 14. Security

- Zod-validate all input server-side
- `rehype-sanitize` on render — Tiptap output is untrusted on the way out
- Drizzle parameterizes; never concatenate SQL
- Secrets never in repo; `ALLOWED_GITHUB_ID` check server-side only
- Rate-limit `/api/upload` and auth routes
- Presigned uploads: short TTL, MIME allow-list, size cap
- CSP — note `app/layout.tsx` already injects an inline theme script, so a strict CSP needs a nonce or hash for it
- Drafts must 404 publicly and stay out of sitemap and RSS

---

## 15. Testing

ARCHITECTURE.md already lists Vitest and Playwright as planned. This feature is a good reason to land them.

- **Vitest:** slug generation, reading time, markdown pipeline, Zod schemas
- **Integration:** queries against a throwaway Neon branch
- **Playwright:** login → draft → publish → public visibility; drafts 404 when logged out
- **CI:** extend the existing `npm run check` (format + lint + type-check) with `test`; run migrations against a preview branch before merge

---

## 16. Build order

```
0. Confirm deploy target; reconcile main vs deployed; fix dep placement
1. Neon + Drizzle schema + migrations + query layer + seed
2. Typography plugin, prose tokens, prose font
3. /blog list + /blog/[slug] + tag pages
4. SEO: metadata, JSON-LD, async sitemap, RSS, OG image
5. Better Auth + GitHub OAuth + middleware
6. Admin CRUD, Tiptap, server actions
7. Image upload
8. Cache tags + revalidation
9. Polish: TOC, reading time, related posts
10. Growth: search, pgvector, comments
```
