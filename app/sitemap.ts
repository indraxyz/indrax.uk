import type { MetadataRoute } from "next"

import { RESUME_CONFIG, SITE_URL } from "@/features/resume/config"

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date(RESUME_CONFIG.updatedAt),
      changeFrequency: "monthly",
      priority: 1,
    },
  ]
}
