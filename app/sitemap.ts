import type { MetadataRoute } from "next"

import { BLOG_CONFIG } from "@/features/blog/config"
import { getPublishedSlugs, getTagsInUse } from "@/features/blog/data/queries"
import { RESUME_CONFIG, absoluteUrl, SITE_URL } from "@/features/resume/config"

// The sitemap is prerendered, so without this it would keep whatever the archive
// looked like at build time. `revalidateTag("posts")` reaches it through the
// tagged queries; the hourly window is the backstop for anything that misses.
export const revalidate = 3600

/**
 * Async now, because two of its entries come from the database rather than from a
 * config file.
 *
 * Only published posts reach it. The query layer filters on status, so a draft
 * cannot appear here by omission - there is no code path that would list one
 * (threat T-4). The same is true of tag pages: `getTagsInUse` joins through to
 * published posts, so a tag whose articles are all drafts has nothing here.
 *
 * With no database configured this degrades to what it was before the blog
 * existed: the root URL, and nothing else.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, tags] = await Promise.all([getPublishedSlugs(), getTagsInUse()])

  const root: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: new Date(RESUME_CONFIG.updatedAt),
      changeFrequency: "monthly",
      priority: 1,
    },
  ]

  // Listed only once there is something to list, so the sitemap never advertises
  // an empty page as a destination.
  if (posts.length === 0) return root

  return [
    ...root,
    {
      url: absoluteUrl(BLOG_CONFIG.basePath),
      // The archive is exactly as fresh as its newest article.
      lastModified: new Date(posts[0].updatedAt),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...posts.map((post) => ({
      url: absoluteUrl(`${BLOG_CONFIG.basePath}/${post.slug}`),
      lastModified: new Date(post.updatedAt),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...tags.map((tag) => ({
      url: absoluteUrl(`${BLOG_CONFIG.basePath}/tag/${tag.slug}`),
      changeFrequency: "weekly" as const,
      priority: 0.4,
    })),
  ]
}
