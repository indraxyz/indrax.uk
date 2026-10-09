// The deployed origin, used to resolve the absolute URLs metadata and the sitemap
// need. Overridable so a preview deployment advertises itself, not production.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://indrax.uk"

// The bare host, for the places that print the site's name rather than link to it -
// the footer credit, the social cards, the PDF. Derived once so it cannot drift
// from the canonical URL the metadata advertises.
export const SITE_HOST = new URL(SITE_URL).host

// A path resolved against the deployment. Feeds, sitemaps and JSON-LD are all read
// somewhere other than this origin, so a relative URL in one of them points at
// whatever the reader happens to be.
export const absoluteUrl = (path: string) => new URL(path, SITE_URL).toString()

export const RESUME_CONFIG = {
  title: "Indra's Resume",
  // Resolved from the built revision by config/site-updated-at.ts, shared by footer/PDF/SEO.
  // Plain Node scripts without build metadata omit the date rather than invent one.
  updatedAt: process.env.NEXT_PUBLIC_SITE_UPDATED_AT?.trim() || null,
} as const

export const UPDATED_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "long",
  day: "numeric",
}

// Section wording lives here because both the page and the PDF render it; when
// each kept its own copy the two drifted apart.
export const SECTION_COPY = {
  experiences:
    "Professional timeline across product engineering, fullstack delivery, and agentic workflow execution.",
  techStack: "Core tools and platforms used to design, build, and run digital products.",
  portfolio:
    "Selected projects that show practical delivery across web, mobile, and integrated product systems.",
} as const

export const SOCIAL_LINKS = {
  github: "https://github.com/indraxyz",
  linkedin: "https://www.linkedin.com/in/indra-cahya-edytya",
} as const
