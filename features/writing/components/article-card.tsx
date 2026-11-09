import type { ReactNode } from "react"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { PostContent } from "@/features/writing/components/post-content"
import { SeriesNav } from "@/features/writing/components/series-nav"
import { PostCover } from "@/features/writing/components/post-cover"
import { PostMeta } from "@/features/writing/components/post-meta"
import { TableOfContents } from "@/features/writing/components/table-of-contents"
import { PostTags } from "@/features/writing/components/post-tags"
import type { Post, RenderedArticle } from "@/features/writing/types"
import { cn } from "@/lib/utils"
import styles from "./article-navigation.module.css"

interface ArticleCardProps {
  post: Omit<Post, "content">
  article: RenderedArticle
  /** Anything extra to sit beside the date and reading time - the view count. */
  meta?: ReactNode
  actions?: ReactNode
  reactions?: ReactNode
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
export function ArticleCard({ post, article, meta, actions, reactions }: ArticleCardProps) {
  return (
    <article
      className={cn(
        "grid min-w-0 items-start gap-6 print:block",
        article.headings.length > 0 && "lg:grid-cols-[16rem_minmax(0,1fr)]"
      )}
    >
      <TableOfContents entries={article.headings} />
      <Card variant="card" className="variant-primary variant-border min-w-0">
        <PostCover post={post} priority />

        <CardHeader className="gap-3 space-y-0">
          {/* The page's only h1. The render pipeline shifts body headings so the
              shallowest becomes an h2, which keeps this true whatever a post
              contains and without skipping a level. */}
          <h1 className="text-3xl font-black uppercase leading-tight tracking-tight sm:text-4xl">
            {post.title}
          </h1>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <PostMeta post={post} />
            {meta}
            {actions && <div className="ml-auto">{actions}</div>}
          </div>

          {reactions}

          <PostTags tags={post.tags} label="Article tags" />
        </CardHeader>

        <CardContent className="pt-2">
          <div className="min-w-0">
            {/* Keep series context before the body so readers can find earlier parts. */}
            {post.seriesContext && (
              <div className="mb-8">
                <SeriesNav context={post.seriesContext} />
              </div>
            )}

            <div className={styles.body}>
              <PostContent html={article.html} />
            </div>
          </div>
        </CardContent>
      </Card>
    </article>
  )
}
