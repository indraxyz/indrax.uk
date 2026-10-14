// The deployed origin, used to resolve the absolute URLs metadata and the sitemap
// need. Overridable so a preview deployment advertises itself, not production.
export const PRODUCTION_SITE_URL = "https://indrax.uk"
export const SITE_URL = process.env.SITE_URL ?? PRODUCTION_SITE_URL

/**
 * Whether search engines may index this deployment.
 *
 * Only production. dev.indrax.uk and local previews are copies of the site: they
 * get a robots.txt that disallows everything and a site-wide `X-Robots-Tag`, so
 * they are neither indexed as duplicates nor a map of paths for crawlers.
 */
export const isIndexableSite = (siteUrl: string) => new URL(siteUrl).origin === PRODUCTION_SITE_URL
export const SITE_INDEXABLE = isIndexableSite(SITE_URL)

// The bare host, for the places that print the site's name rather than link to it -
// the footer credit, the social cards, the PDF. Derived once so it cannot drift
// from the canonical URL the metadata advertises.
export const SITE_HOST = new URL(SITE_URL).host

// A path resolved against the deployment. Feeds, sitemaps and JSON-LD are all read
// somewhere other than this origin, so a relative URL in one of them points at
// whatever the reader happens to be.
export const absoluteUrl = (path: string) => new URL(path, SITE_URL).toString()

export const SOCIAL_LINKS = {
  github: "https://github.com/indraxyz",
  linkedin: "https://www.linkedin.com/in/indra-cahya-edytya",
} as const
