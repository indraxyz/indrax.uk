import { pdf } from "@react-pdf/renderer"
import { ResumeDocument } from "@/features/resume/pdf/resume-document"

/** Browser-only boundary keeps the PDF renderer out of the Worker bundle. */
export function generateResumePdf() {
  return pdf(<ResumeDocument />).toBlob()
}
