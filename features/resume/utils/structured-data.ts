import { RESUME_CONFIG, SITE_URL, SOCIAL_LINKS } from "@/features/resume/config"
import { bio, education, experiences, personalInfo } from "@/features/resume/data/resume"

// "Juicebox ID/AU, Bali" -> "Juicebox ID/AU". schema.org wants the organisation,
// not the office it happens to sit in.
function organisationName(company: string) {
  return company.split(",")[0].trim()
}

/**
 * The Person behind the page, in the shape search engines read.
 *
 * Every value is derived from the resume data. Nothing here is retyped: a second
 * copy of the bio or the job title would drift the moment the page changed, and a
 * structured-data block that contradicts the page is worse than none.
 *
 * `telephone` and `birthDate` are deliberately absent. A phone number in structured
 * data is a standing invitation to scrapers, the date of birth is a separate
 * discussion about which personal fields belong on an internationally-facing site,
 * and neither is needed to resolve the identity.
 */
export function buildProfileStructuredData() {
  const currentRole = experiences[0]
  const highestDegree = education[0]

  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    dateModified: RESUME_CONFIG.updatedAt,
    mainEntity: {
      "@type": "Person",
      name: personalInfo.name,
      jobTitle: personalInfo.title,
      // The bio is authored with line breaks for the hero; a description is a
      // sentence.
      description: bio.replace(/\s+/g, " ").trim(),
      url: SITE_URL,
      image: new URL("/foto-profile.jpg", SITE_URL).toString(),
      ...(personalInfo.email ? { email: `mailto:${personalInfo.email}` } : {}),
      address: {
        "@type": "PostalAddress",
        addressLocality: personalInfo.address,
      },
      worksFor: {
        "@type": "Organization",
        name: organisationName(currentRole.company),
      },
      alumniOf: {
        "@type": "EducationalOrganization",
        name: highestDegree.institution,
      },
      knowsAbout: personalInfo.highlightSkills ?? [],
      // The claim that actually earns its place: these addresses are one person.
      sameAs: [SOCIAL_LINKS.github, SOCIAL_LINKS.linkedin],
    },
  }
}
