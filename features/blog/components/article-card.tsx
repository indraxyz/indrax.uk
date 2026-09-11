import type { ReactNode } from "react"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { PostContent } from "@/features/blog/components/post-content"
import { SeriesNav } from "@/features/blog/components/series-nav"
import { PostCover } from "@/features/blog/components/post-cover"
import { PostMeta } from "@/features/blog/components/post-meta"
import { TableOfContents } from "@/features/blog/components/table-of-contents"
import { TagPill } from "@/features/blog/components/tag-pill"
import type { Post, RenderedArticle } from "@/features/blog/types"

interface ArticleCardProps {
  post: Post
  article: RenderedArticle
  /** Anything extra to sit beside the date and reading time - the view count. */
  meta?: ReactNode
}

/**
 * The article itself: cover, title, byline, tags, contents, body.
 *
 * Shared by the published page and the draft preview, which render exactly the
 * same thing and differ only in what surrounds it - the preview has a banner and
 * no structured data, no view beacon and no related posts.
 *
 * Written twice at first, and the second copy was already one heading class out of
 * step. Article typography should be changed in one place.
 */
export function ArticleCard({ post, article, meta }: ArticleCardProps) {
  return (
    <article>
      <Card variant="card" className="variant-primary variant-border">
        <PostCover post={post} priority />

        <CardHeader className="gap-4">
          {/* The page's only h1. The render pipeline shifts body headings so the
              shallowest becomes an h2, which keeps this true whatever a post
              contains and without skipping a level. */}
          <h1 className="text-3xl font-black uppercase leading-tight tracking-tight sm:text-4xl">
            {post.title}
          </h1>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <PostMeta post={post} />
            {meta}
          </div>

          {post.tags.length > 0 && (
            <nav aria-label="Article tags" className="flex flex-wrap items-center gap-2">
              {post.tags.map((tag) => (
                <TagPill key={tag.id} tag={tag} />
              ))}
            </nav>
          )}
        </CardHeader>

        <CardContent className="pt-2">
          {/* Above the contents list, because someone arriving at part four from a
              search result needs to know there are three articles before it
              before they read it, not after. */}
          {post.seriesContext && (
            <div className="mb-8">
              <SeriesNav context={post.seriesContext} />
            </div>
          )}

          <TableOfContents entries={article.headings} className="mb-8 print:hidden" />
          <PostContent html={article.html} />
        </CardContent>
      </Card>
    </article>
  )
}
