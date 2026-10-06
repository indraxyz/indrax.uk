import { Newspaper } from "lucide-react"

import { SectionCard } from "@/components/ui/section-card"
import { PostCard } from "@/features/writing/components/post-card"
import { PostGrid } from "@/features/writing/components/post-grid"
import { WRITING_CONFIG, SECTION_COPY } from "@/features/writing/config"
import { getRecentPosts } from "@/features/writing/data/queries"

// Enough to show recent writing without turning the home page into an archive.
const POSTS_ON_HOMEPAGE = 3

/**
 * The home page's entry point into the writing.
 *
 * Renders nothing at all when there is nothing published - not an empty card, not
 * a "coming soon" (PRD US-2.3). That also makes it invisible on a deployment with
 * no database configured, which is the state of every fresh clone.
 *
 * Composed from the site's `SectionCard` design so it matches the other sections.
 */
export async function WritingSection() {
  const posts = await getRecentPosts(POSTS_ON_HOMEPAGE)

  if (posts.length === 0) return null

  return (
    <SectionCard
      variant="ghost"
      icon={<Newspaper className="h-5 w-5" />}
      title="Writing"
      subtitle={SECTION_COPY.homeWriting}
      link={{ href: WRITING_CONFIG.basePath, textLink: "All writing" }}
      // The home page's print view focuses on the introduction; article cards
      // belong on screen, where their links can be followed.
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
