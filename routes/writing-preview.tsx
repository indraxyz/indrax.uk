import { useQuery } from "@tanstack/react-query"
import { useParams, useSearchParams } from "react-router"

import { api } from "@/lib/api-client"
import { WRITING_CONFIG } from "@/features/writing/config"
import { ArticleCard } from "@/features/writing/components/article-card"
import { WritingShell } from "@/features/writing/components/writing-shell"
import { CopyCode } from "@/features/writing/components/copy-code"
import { QueryState } from "@/features/writing/components/query-state"
import { PreviewBanner } from "@/features/writing/components/preview-banner"
import type { Post, RenderedArticle } from "@/features/writing/types"

export const meta = () => [
  { title: "Draft preview" },
  { name: "robots", content: "noindex, nofollow, noarchive" },
  { name: "referrer", content: "no-referrer" },
]
export const headers = () => ({
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
})

interface PreviewData {
  post: Omit<Post, "content">
  article: RenderedArticle
}

export function fetchPreview(slug: string, token: string) {
  return api
    .get(`/api/writing/preview/${encodeURIComponent(slug)}`, {
      searchParams: { token },
      cache: "no-store",
      referrerPolicy: "no-referrer",
    })
    .json<PreviewData>()
}

export default function PreviewPage() {
  const { slug = "" } = useParams()
  const [params] = useSearchParams()
  const token = params.get("token") ?? ""
  const preview = useQuery({
    queryKey: ["preview", slug, token],
    queryFn: () => fetchPreview(slug, token),
    enabled: !!token,
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
  if (!token || preview.isError)
    return (
      <WritingShell>
        <h1 className="text-2xl font-black uppercase">Not found</h1>
        <p>This preview link is invalid or expired.</p>
      </WritingShell>
    )
  if (!preview.data)
    return (
      <WritingShell>
        <h1 className="text-2xl font-black uppercase">Draft preview</h1>
        <QueryState />
      </WritingShell>
    )
  const { post, article } = preview.data
  return (
    <WritingShell
      breadcrumbs={[
        { name: "Home", path: "/" },
        { name: WRITING_CONFIG.title, path: WRITING_CONFIG.basePath },
        { name: `Preview: ${post.title}` },
      ]}
    >
      <PreviewBanner status={post.status} />
      <ArticleCard post={post} article={article} />
      <CopyCode />
    </WritingShell>
  )
}
