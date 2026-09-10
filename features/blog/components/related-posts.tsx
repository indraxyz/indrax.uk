import { SectionCard } from "@/components/ui/section-card"
import { PostCard } from "@/features/blog/components/post-card"
import type { PostSummary } from "@/features/blog/types"
import { Newspaper } from "lucide-react"

interface RelatedPostsProps {
  posts: PostSummary[]
}

/**
 * Other articles sharing a tag with this one.
 *
 * Renders nothing when there are none, which is the common case on a young blog -
 * an empty "related" strip advertises that there is nothing else to read.
 */
export function RelatedPosts({ posts }: RelatedPostsProps) {
  if (posts.length === 0) return null

  return (
    <SectionCard
      variant="ghost"
      icon={<Newspaper className="h-5 w-5" />}
      title="Related"
      subtitle="Other articles sharing a tag with this one."
      className="print:hidden"
    >
      <div className="grid gap-6 md:grid-cols-3">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} headingLevel={3} />
        ))}
      </div>
    </SectionCard>
  )
}
