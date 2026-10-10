import { pageMeta } from "@/app/routes/meta"
import { personalInfo, bio } from "@/features/resume/data/resume"

import { HomePage } from "@/features/home/components/home-page"
import { buildProfileStructuredData } from "@/features/resume/utils/structured-data"
import { serialiseJsonLd } from "@/lib/utils"

export const meta = () => pageMeta(personalInfo.name, bio, "/", "profile")

export default function HomeRoute() {
  const structuredData = buildProfileStructuredData()

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serialiseJsonLd(structuredData) }}
      />
      <HomePage />
    </>
  )
}
