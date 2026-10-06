import { SectionCard } from "@/components/ui/section-card"
import { PostCard } from "@/features/writing/components/post-card"
import { PostGrid } from "@/features/writing/components/post-grid"
import type { PostSummary } from "@/features/writing/types"
import { Newspaper } from "lucide-react"

interface RelatedPostsProps {
  posts: PostSummary[]
}

/**
 * Other articles sharing a tag with this one.
 *
 * Renders nothing when there are none, which is the common case on a young writing -
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
      <PostGrid>
        {posts.map((post) => (
          <PostCard key={post.id} post={post} headingLevel={3} />
        ))}
      </PostGrid>
    </SectionCard>
  )
}
