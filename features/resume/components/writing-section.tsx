import { Newspaper } from "lucide-react"

import { SectionCard } from "@/components/ui/section-card"
import { PostCard } from "@/features/blog/components/post-card"
import { BLOG_CONFIG, SECTION_COPY } from "@/features/blog/config"
import { getRecentPosts } from "@/features/blog/data/queries"

// Enough to show the blog is alive without turning the resume into a list page.
const POSTS_ON_HOMEPAGE = 3

/**
 * The resume page's entry point into the blog.
 *
 * Renders nothing at all when there is nothing published - not an empty card, not
 * a "coming soon" (PRD US-2.3). That also makes it invisible on a deployment with
 * no database configured, which is the state of every fresh clone.
 *
 * Composed from `SectionCard` like the three sections above it, so it matches them
 * without carrying its own copy of their styling.
 */
export async function WritingSection() {
  const posts = await getRecentPosts(POSTS_ON_HOMEPAGE)

  if (posts.length === 0) return null

  return (
    <SectionCard
      variant="ghost"
      icon={<Newspaper className="h-5 w-5" />}
      title={BLOG_CONFIG.title}
      subtitle={SECTION_COPY.writing}
      link={{ href: BLOG_CONFIG.basePath, textLink: "All articles" }}
      // The printed sheet is a CV. Three article cards with excerpts on it would
      // cost a page and say nothing an employer asked for, so the section is a
      // screen-only entry point and print output is unchanged.
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
