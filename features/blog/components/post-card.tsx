import { ArrowRight } from "lucide-react"
import Link from "next/link"

import { Card, CardContent, CardHeader, CardTitle, type CardTitleLevel } from "@/components/ui/card"
import { PostCover } from "@/features/blog/components/post-cover"
import { PostMeta } from "@/features/blog/components/post-meta"
import { TagPill } from "@/features/blog/components/tag-pill"
import type { PostSummary } from "@/features/blog/types"

interface PostCardProps {
  post: PostSummary
  priority?: boolean
  // h2 on the list pages, whose section header is the page h1. h3 on the resume,
  // where the "Writing" section header is itself an h2.
  headingLevel?: CardTitleLevel
}

export function PostCard({ post, priority = false, headingLevel = 2 }: PostCardProps) {
  return (
    <Card
      variant="card"
      // `relative` is what the title's stretched hit area below is measured against.
      className="variant-secondary variant-border relative flex flex-col bg-[var(--variant-soft)] transition-shadow hover:shadow-soft-lg"
    >
      <PostCover post={post} priority={priority} />

      <CardHeader className="gap-3 pb-4">
        <CardTitle level={headingLevel} className="text-lg leading-snug">
          {/* The whole card is not a link: the tags inside it are links too, and
              nesting them would be invalid. The title carries the navigation and
              stretches its hit area over the card instead. */}
          <Link
            href={`/blog/${post.slug}`}
            className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background hover:underline"
          >
            {post.title}
          </Link>
        </CardTitle>
        <PostMeta post={post} />
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-4">
        {post.excerpt && (
          <p className="flex-1 text-sm font-medium leading-relaxed text-foreground">
            {post.excerpt}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {post.tags.map((tag) => (
            // Above the title's stretched hit area, so a tag link stays clickable.
            <span key={tag.id} className="relative z-10">
              <TagPill tag={tag} />
            </span>
          ))}
        </div>

        {/* Decoration. The title link above already carries the navigation and its
            hit area covers the card, so announcing a second "Read" is noise. */}
        <span
          aria-hidden
          className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[var(--component-variant-secondary-bg)]"
        >
          Read <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </CardContent>
    </Card>
  )
}
