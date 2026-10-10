import { WRITING_CONFIG } from "@/features/writing/config"
import type { Post } from "@/features/writing/types"
import { absoluteUrl, SITE_URL, SOCIAL_LINKS } from "@/config/site"
import { personalInfo } from "@/features/resume/data/resume"

/**
 * `Article` JSON-LD for one post.
 *
 * Every value is derived from the row or from the resume data file. Nothing here
 * is a second copy of a string that already exists somewhere else, which is the
 * same discipline `features/resume/utils/structured-data.ts` follows - a
 * hand-maintained duplicate is a claim that quietly stops being true.
 */
export function buildArticleStructuredData(post: Omit<Post, "content">) {
  const url = absoluteUrl(`${WRITING_CONFIG.basePath}/${post.slug}`)

  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt ?? undefined,
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    datePublished: post.publishedAt ?? undefined,
    dateModified: post.updatedAt,
    // The per-post Open Graph card, which exists for every post whether or not it
    // has a cover, so this property is never absent.
    image: absoluteUrl(`${WRITING_CONFIG.basePath}/${post.slug}/opengraph-image`),
    author: {
      "@type": "Person",
      name: personalInfo.name,
      url: SITE_URL,
      sameAs: [SOCIAL_LINKS.github, SOCIAL_LINKS.linkedin],
    },
    publisher: {
      "@type": "Person",
      name: personalInfo.name,
      url: SITE_URL,
    },
    keywords: post.tags.length > 0 ? post.tags.map((tag) => tag.name) : undefined,
    inLanguage: "en",
  }
}

/** The trail a crawler shows under the result: site › writing › this post. */
export function buildBreadcrumbStructuredData(trail: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  }
}
