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
