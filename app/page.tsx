import { ResumePage } from "@/features/resume/components/resume-page"
import { buildProfileStructuredData } from "@/features/resume/utils/structured-data"

export default function HomePage() {
  const structuredData = buildProfileStructuredData()

  return (
    <>
      {/* The block is built from committed data, never from user input. `<` is
          still escaped, because a "</script>" appearing in the resume copy one day
          would otherwise close this tag early and spill the rest onto the page. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />
      <ResumePage />
    </>
  )
}
