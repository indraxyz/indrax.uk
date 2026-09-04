import { renderToBuffer } from "@react-pdf/renderer"

import { RESUME_PDF_FILE_NAME } from "@/features/resume/config"
import { ResumeDocument } from "@/features/resume/pdf/resume-document"

// The renderer is Node-native, and the document is a pure function of committed
// data, so the file is drawn once during `next build` and served as a static asset
// afterwards. A document or font path that breaks therefore fails the build rather
// than the visitor.
export const runtime = "nodejs"
export const dynamic = "force-static"

export async function GET() {
  const pdf = await renderToBuffer(<ResumeDocument />)

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      // `inline`, so pasting the URL opens the CV in the browser. The footer link
      // carries its own `download` attribute for people who want the file itself.
      "Content-Disposition": `inline; filename="${RESUME_PDF_FILE_NAME}"`,
      // The file only changes when the resume data does, which means a new build.
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  })
}
