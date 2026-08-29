export const RESUME_CONFIG = {
  title: "Indra's Resume",
  // The date the resume content last changed. Deliberately authored rather than
  // derived from `new Date()`: this page is statically rendered, so a computed
  // date would freeze at build time and claim an update that never happened.
  updatedAt: "2026-08-29",
} as const

export const SOCIAL_LINKS = {
  github: "https://github.com/indraxyz",
  linkedin: "https://www.linkedin.com/in/indra-cahya-edytya",
} as const
