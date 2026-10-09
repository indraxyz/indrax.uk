import { buildBreadcrumbStructuredData } from "@/features/writing/utils/structured-data"
import { serialiseJsonLd } from "@/lib/utils"
import { SITE_URL } from "@/features/resume/config"
import { useQuery } from "@tanstack/react-query"
import {
  useParams,
  useSearchParams,
  type MetaFunction,
  type ClientLoaderFunctionArgs,
} from "react-router"
import { getBrowserQueryClient } from "@/components/query-provider"

import { EmptyState } from "@/features/writing/components/empty-state"
import { PostListSection } from "@/features/writing/components/post-list-section"
import { QueryState } from "@/features/writing/components/query-state"
import { WritingShell } from "@/features/writing/components/writing-shell"
import { writingApi, writingKeys } from "@/features/writing/api/client"
import { WRITING_CONFIG, EMPTY_COPY, tagSubtitle } from "@/features/writing/config"
import { parsePageParam } from "@/features/writing/utils/page-param"

export function loader() {
  return null
}

export async function clientLoader({ request, params }: ClientLoaderFunctionArgs) {
  const page = parsePageParam(new URL(request.url).searchParams.get("page") ?? undefined)
  const slug = params.tag ?? ""
  const client = getBrowserQueryClient()
  await Promise.all([
    client.prefetchQuery({
      queryKey: writingKeys.posts(page, slug),
      queryFn: () => writingApi.posts(page, slug),
    }),
    client.prefetchQuery({ queryKey: writingKeys.tags(), queryFn: writingApi.tags }),
  ])
  return null
}

export const meta: MetaFunction = ({ params, location }) => {
  const page = parsePageParam(new URLSearchParams(location.search).get("page") ?? undefined)
  const path = `/writing/tags/${encodeURIComponent(params.tag ?? "")}`
  return [
    { title: "Tags - Writing" },
    {
      tagName: "link",
      rel: "canonical",
      href: new URL(page > 1 ? `${path}?page=${page}` : path, SITE_URL).href,
    },
  ]
}

export default function TagPage() {
  const { tag: slug = "" } = useParams()
  const [params] = useSearchParams()
  const page = parsePageParam(params.get("page") ?? undefined)
  const tags = useQuery({ queryKey: writingKeys.tags(), queryFn: writingApi.tags })
  const results = useQuery({
    queryKey: writingKeys.posts(page, slug),
    queryFn: () => writingApi.posts(page, slug),
  })
  const tag = tags.data?.find((item) => item.slug === slug)
  if (tags.data && !tag)
    return (
      <WritingShell>
        <meta name="robots" content="noindex,follow" />
        <h1 className="text-2xl font-black uppercase">Not found</h1>
        <p>This tag has no published articles.</p>
      </WritingShell>
    )
  const breadcrumbTrail = [
    { name: "Home", path: "/" },
    { name: WRITING_CONFIG.title, path: WRITING_CONFIG.basePath },
    { name: tag?.name ?? slug, path: `${WRITING_CONFIG.tagPath}/${slug}` },
  ]
  return (
    <WritingShell breadcrumbs={breadcrumbTrail}>
      {tag && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serialiseJsonLd(buildBreadcrumbStructuredData(breadcrumbTrail)),
          }}
        />
      )}
      {tag && results.data ? (
        <PostListSection
          title={tag.name}
          subtitle={tagSubtitle(tag.name)}
          results={results.data}
          basePath={`${WRITING_CONFIG.tagPath}/${slug}`}
          emptyState={<EmptyState message={EMPTY_COPY.tag(tag.name)} />}
        />
      ) : (
        <>
          <h1 className="text-2xl font-black uppercase">{tag?.name ?? "Writing"}</h1>
          <QueryState
            error={results.isError || tags.isError}
            retry={() => {
              void results.refetch()
              void tags.refetch()
            }}
          />
        </>
      )}
    </WritingShell>
  )
}
