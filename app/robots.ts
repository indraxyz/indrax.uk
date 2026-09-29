import type { MetadataRoute } from "next"

import { SITE_URL } from "@/features/resume/config"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Nothing serves this path yet - the admin arrives with the authoring
      // phase. Disallowing it now costs nothing and means the rule is already in
      // place on the day the route first exists, rather than being the thing
      // somebody remembers to add afterwards (PRD US-4.2).
      disallow: "/admin",
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
