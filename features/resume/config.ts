export const RESUME_CONFIG = {
  title: "Indra's Resume",
  // Resolved from the built revision by config/site-updated-at.ts, shared by PDF/SEO.
  // Plain Node scripts without build metadata omit the date rather than invent one.
  updatedAt: process.env.SITE_UPDATED_AT?.trim() || null,
} as const

export const UPDATED_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "long",
  day: "numeric",
}
