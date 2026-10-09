import { Layers } from "lucide-react"
import { Link, useParams, type MetaFunction } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { HTTPError } from "ky"
import { pageMeta } from "@/routes/meta"

import { SectionCard } from "@/components/ui/section-card"
import { WritingShell } from "@/features/writing/components/writing-shell"
import { WRITING_CONFIG, seriesSubtitle } from "@/features/writing/config"
import { writingApi, writingKeys } from "@/features/writing/api/client"
import { QueryState } from "@/features/writing/components/query-state"
import type { SeriesPartDetail } from "@/features/writing/types"
import { buildBreadcrumbStructuredData } from "@/features/writing/utils/structured-data"
import { formatDate } from "@/lib/utils/date"
import { serialiseJsonLd } from "@/lib/utils"

const pathFor = (slug: string) => `${WRITING_CONFIG.seriesPath}/${slug}`

export const meta: MetaFunction = ({ params }) =>
  pageMeta(
    `Series - ${WRITING_CONFIG.title}`,
    "Read published articles in series order.",
    pathFor(params.slug ?? ""),
    "website",
    "/opengraph-image"
  )

function Part({ part, index }: { part: SeriesPartDetail; index: number }) {
  return (
    <li className="border-b-2 border-border last:border-b-0">
      <Link
        prefetch="none"
        to={`${WRITING_CONFIG.basePath}/${part.slug}`}
        className="group flex gap-4 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {/* The position a reader sees, counted over what is actually readable -
            not the author's stored ordering, which keeps its gaps while a series
            is being written. */}
        <span
          aria-hidden
          className="shrink-0 text-sm font-black tabular-nums text-muted-foreground"
        >
          {String(index + 1).padStart(2, "0")}
        </span>

        <span className="flex flex-col gap-1">
          <span className="text-base font-black leading-snug text-foreground group-hover:underline">
            {part.title}
          </span>

          {part.excerpt ? (
            <span className="text-sm font-medium leading-relaxed text-muted-foreground">
              {part.excerpt}
            </span>
          ) : null}

          <span className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
            {part.publishedAt ? formatDate(part.publishedAt) : "Unpublished"}
            {part.readingTime ? ` · ${part.readingTime} min read` : ""}
          </span>
        </span>
      </Link>
    </li>
  )
}

export default function SeriesPage() {
  const { slug = "" } = useParams()
  const results = useQuery({
    queryKey: writingKeys.series(slug),
    queryFn: () => writingApi.series(slug),
  })
  if (results.error instanceof HTTPError && results.error.response.status === 404) {
    return (
      <WritingShell>
        <meta name="robots" content="noindex,follow" />
        <h1 className="text-2xl font-black uppercase">Not found</h1>
        <p>This series has no published articles.</p>
      </WritingShell>
    )
  }
  if (!results.data)
    return (
      <WritingShell>
        <h1 className="text-2xl font-black uppercase">Series</h1>
        <QueryState error={results.isError} retry={() => void results.refetch()} />
      </WritingShell>
    )
  const { series, parts } = results.data
  const breadcrumbTrail = [
    { name: "Home", path: "/" },
    { name: WRITING_CONFIG.title, path: WRITING_CONFIG.basePath },
    { name: series.title, path: pathFor(series.slug) },
  ]
  const breadcrumbs = buildBreadcrumbStructuredData(breadcrumbTrail)

  return (
    <WritingShell breadcrumbs={breadcrumbTrail}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serialiseJsonLd(breadcrumbs) }}
      />

      <SectionCard
        variant="ghost"
        icon={<Layers className="h-5 w-5" />}
        title={series.title}
        subtitle={series.description ?? seriesSubtitle(parts.length)}
        // This page has no hero above it, so this is its only top-level heading.
        headingLevel={1}
      >
        <ol className="border-t-2 border-border">
          {parts.map((part, index) => (
            <Part key={part.slug} part={part} index={index} />
          ))}
        </ol>
      </SectionCard>
    </WritingShell>
  )
}
