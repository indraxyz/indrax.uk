import { Newspaper } from "lucide-react"
import { useQuery } from "@tanstack/react-query"

import { SectionCard } from "@/components/ui/section-card"
import { RAIL_CARD_WIDTH } from "@/components/ui/card-rail"
import { PostCard } from "@/features/writing/components/post-card"
import { WRITING_CONFIG, SECTION_COPY } from "@/features/writing/config"
import { writingApi, writingKeys } from "@/features/writing/api/client"

// Enough to browse recent writing in the rail without turning the home page into
// an archive. The recent endpoint accepts at most 10.
const POSTS_ON_HOMEPAGE = 9

/**
 * The home page's entry point into the writing.
 *
 * Renders nothing at all when there is nothing published - not an empty card, not
 * a "coming soon" (PRD US-2.3). That also makes it invisible on a deployment with
 * no database configured, which is the state of every fresh clone.
 *
 * Composed from the site's `SectionCard` design so it matches the other sections.
 */
export function WritingSection() {
  const { data: posts = [] } = useQuery({
    queryKey: writingKeys.recent(POSTS_ON_HOMEPAGE),
    queryFn: () => writingApi.recent(POSTS_ON_HOMEPAGE),
  })

  if (posts.length === 0) return null

  return (
    <SectionCard
      variant="ghost"
      icon={<Newspaper className="h-5 w-5" />}
      title="Writing"
      subtitle={SECTION_COPY.homeWriting}
      link={{ href: WRITING_CONFIG.basePath, textLink: "All writing" }}
      // A horizontal rail with the shared scroll-region semantics, like the
      // resume's Tech Stack.
      carousel
      carouselFullBleed
      // The home page's print view focuses on the introduction; article cards
      // belong on screen, where their links can be followed.
      className="print:hidden"
    >
      {posts.map((post) => (
        <PostCard key={post.id} post={post} headingLevel={3} className={RAIL_CARD_WIDTH} />
      ))}
    </SectionCard>
  )
}
