import { Layers } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { SectionCard } from "@/components/ui/section-card"
import { WritingShell } from "@/features/writing/components/writing-shell"
import { WRITING_CONFIG, seriesSubtitle } from "@/features/writing/config"
import { getSeriesBySlug, getSeriesSlugs } from "@/features/writing/data/queries"
import type { SeriesPartDetail } from "@/features/writing/types"
import { buildBreadcrumbStructuredData } from "@/features/writing/utils/structured-data"
import { formatDate } from "@/lib/utils/date"
import { serialiseJsonLd } from "@/lib/utils"

interface SeriesPageProps {
  params: Promise<{ slug: string }>
}

const pathFor = (slug: string) => `${WRITING_CONFIG.seriesPath}/${slug}`

export async function generateStaticParams() {
  return (await getSeriesSlugs()).map(({ slug }) => ({ slug }))
}

export async function generateMetadata({ params }: SeriesPageProps): Promise<Metadata> {
  const { slug } = await params
  const found = await getSeriesBySlug(slug)

  if (!found || found.parts.length === 0) {
    return { title: "Not found", robots: { index: false, follow: false } }
  }

  const description = found.series.description ?? seriesSubtitle(found.parts.length)
  const path = pathFor(found.series.slug)

  return {
    title: `${found.series.title} - ${WRITING_CONFIG.title}`,
    description,
    // A real entry point, the same way a tag page is: it collects articles under
    // a heading nothing else on the site provides.
    alternates: { canonical: path },
    robots: { index: true, follow: true },
    openGraph: { type: "website", url: path, title: found.series.title, description },
  }
}

function Part({ part, index }: { part: SeriesPartDetail; index: number }) {
  return (
    <li className="border-b-2 border-border last:border-b-0">
      <Link
        prefetch={false}
        href={`${WRITING_CONFIG.basePath}/${part.slug}`}
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

export default async function SeriesPage({ params }: SeriesPageProps) {
  const { slug } = await params
  const found = await getSeriesBySlug(slug)

  // A series with nothing published in it is not a page. Same rule as a tag whose
  // every article is still a draft: no entry point, and no way to tell it from a
  // slug that was never used (PRD US-2.2).
  if (!found || found.parts.length === 0) notFound()

  const { series, parts } = found

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
