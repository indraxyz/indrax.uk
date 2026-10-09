import { SITE_URL } from "@/features/resume/config"
import { useQuery } from "@tanstack/react-query"
import { useSearchParams, type MetaFunction } from "react-router"

import { EmptyState } from "@/features/writing/components/empty-state"
import { PostListSection } from "@/features/writing/components/post-list-section"
import { QueryState } from "@/features/writing/components/query-state"
import { SearchForm } from "@/features/writing/components/search-form"
import { TagPill } from "@/features/writing/components/tag-pill"
import { WritingShell } from "@/features/writing/components/writing-shell"
import { writingApi, writingKeys } from "@/features/writing/api/client"
import { WRITING_CONFIG, EMPTY_COPY, SECTION_COPY } from "@/features/writing/config"
import { parsePageParam } from "@/features/writing/utils/page-param"

export const meta: MetaFunction = ({ location }) => {
  const page = parsePageParam(new URLSearchParams(location.search).get("page") ?? undefined)
  return [
    { title: page > 1 ? `Writing - page ${page}` : "Writing" },
    {
      tagName: "link",
      rel: "canonical",
      href: new URL(page > 1 ? `/writing?page=${page}` : "/writing", SITE_URL).href,
    },
  ]
}

export default function WritingPage() {
  const [params] = useSearchParams()
  const page = parsePageParam(params.get("page") ?? undefined)
  const posts = useQuery({
    queryKey: writingKeys.posts(page),
    queryFn: () => writingApi.posts(page),
  })
  const tags = useQuery({ queryKey: writingKeys.tags(), queryFn: writingApi.tags })
  return (
    <WritingShell>
      {posts.data ? (
        <PostListSection
          title={WRITING_CONFIG.title}
          subtitle={SECTION_COPY.writing}
          results={posts.data}
          basePath={WRITING_CONFIG.basePath}
          emptyState={<EmptyState message={EMPTY_COPY.writing} />}
        >
          <div className="space-y-4 pb-2">
            <SearchForm query="" />
            {!!tags.data?.length && (
              <nav aria-label="Tags" className="flex flex-wrap items-center gap-2">
                {tags.data.map((tag) => (
                  <TagPill key={tag.id} tag={tag} count={tag.postCount} />
                ))}
              </nav>
            )}
          </div>
        </PostListSection>
      ) : (
        <>
          <h1 className="text-2xl font-black uppercase">Writing</h1>
          <SearchForm query="" />
          <QueryState error={posts.isError} retry={() => void posts.refetch()} />
        </>
      )}
    </WritingShell>
  )
}
