// The deployed origin, used to resolve the absolute URLs metadata and the sitemap
// need. Overridable so a preview deployment advertises itself, not production.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://indrax.uk"

export const RESUME_CONFIG = {
  title: "Indra's Resume",
  // The date the resume content last changed. Deliberately authored rather than
  // derived from `new Date()`: this page is statically rendered, so a computed
  // date would freeze at build time and claim an update that never happened.
  updatedAt: "2026-08-29",
} as const

// Section wording lives here because both the page and the PDF render it; when
// each kept its own copy the two drifted apart.
export const SECTION_COPY = {
  experiences:
    "Professional timeline across product engineering, fullstack delivery, and agentic workflow execution.",
  techStack:
    "A structured view of the technologies, platforms, and engineering practices used to design, build, operate, and improve digital products.",
  portfolio:
    "Selected projects that show practical delivery across web, mobile, and integrated product systems.",
} as const

export const SOCIAL_LINKS = {
  github: "https://github.com/indraxyz",
  linkedin: "https://www.linkedin.com/in/indra-cahya-edytya",
} as const
