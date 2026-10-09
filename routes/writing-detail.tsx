import { Eye } from "lucide-react"
import { useLoaderData, type LoaderFunctionArgs, type MetaFunction } from "react-router"
import { pageMeta } from "@/routes/meta"

import { ArticleCard } from "@/features/writing/components/article-card"
import { WritingShell } from "@/features/writing/components/writing-shell"
import { CopyCode } from "@/features/writing/components/copy-code"
import { RelatedPosts } from "@/features/writing/components/related-posts"
import { ViewBeacon } from "@/features/writing/components/view-beacon"
import { WRITING_CONFIG } from "@/features/writing/config"
import { getPostBySlug, getRelatedPosts } from "@/features/writing/data/queries"
import { getRenderedArticle } from "@/features/writing/data/rendered-article"
import {
  buildArticleStructuredData,
  buildBreadcrumbStructuredData,
} from "@/features/writing/utils/structured-data"
import { personalInfo } from "@/features/resume/data/resume"
import { serialiseJsonLd } from "@/lib/utils"

export async function loader({ params }: LoaderFunctionArgs) {
  const post = await getPostBySlug(params.slug ?? "")
  if (!post) throw new Response("Not found", { status: 404 })
  const [article, related] = await Promise.all([getRenderedArticle(post), getRelatedPosts(post.id)])
  // The hydrated route only needs the rendered HTML; keep the editor document on the server.
  const { content, ...summary } = post
  void content
  return { post: summary, article, related }
}

export const meta: MetaFunction<typeof loader> = ({ loaderData: data }) => {
  if (!data) return [{ title: "Not found" }, { name: "robots", content: "noindex, nofollow" }]
  const { post } = data
  return [
    ...pageMeta(
      post.title,
      post.excerpt ?? WRITING_CONFIG.feedDescription,
      `${WRITING_CONFIG.basePath}/${post.slug}`,
      "article"
    ),
    { name: "author", content: personalInfo.name },
    { property: "article:modified_time", content: post.updatedAt },
    ...(post.publishedAt
      ? [{ property: "article:published_time", content: post.publishedAt }]
      : []),
    ...post.tags.map((tag) => ({ property: "article:tag", content: tag.name })),
  ]
}

export default function ArticlePage() {
  const { post, article, related } = useLoaderData<typeof loader>()
  const breadcrumbTrail = [
    { name: "Home", path: "/" },
    { name: WRITING_CONFIG.title, path: WRITING_CONFIG.basePath },
    { name: post.title, path: `${WRITING_CONFIG.basePath}/${post.slug}` },
  ]
  const structuredData = [
    buildArticleStructuredData(post),
    buildBreadcrumbStructuredData(breadcrumbTrail),
  ]

  return (
    <WritingShell breadcrumbs={breadcrumbTrail}>
      {structuredData.map((data) => (
        <script
          key={data["@type"]}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serialiseJsonLd(data) }}
        />
      ))}

      <ArticleCard
        post={post}
        article={article}
        meta={
          post.viewCount > 0 && (
            <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
              <Eye className="h-3.5 w-3.5" aria-hidden />
              {post.viewCount.toLocaleString("en-US")} views
            </span>
          )
        }
      />

      <RelatedPosts posts={related} />

      {/* Both are decoration, and both are additive: the article above is complete
          without either. The counter is an image so it works with JavaScript off;
          the copy buttons are the one thing on this page that needs a script, and
          they are attached only after the page has already rendered. */}
      <ViewBeacon slug={post.slug} />
      <CopyCode />
    </WritingShell>
  )
}
