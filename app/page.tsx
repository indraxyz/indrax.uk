import { ResumePage } from "@/features/resume/components/resume-page"
import { buildProfileStructuredData } from "@/features/resume/utils/structured-data"
import { serialiseJsonLd } from "@/lib/utils"

export default function HomePage() {
  const structuredData = buildProfileStructuredData()

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serialiseJsonLd(structuredData) }}
      />
      <ResumePage />
    </>
  )
}
