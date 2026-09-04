"use client"

import { Download } from "lucide-react"

import { Button } from "@/components/ui/button"
import { RESUME_PDF_FILE_NAME, RESUME_PDF_PATH } from "@/features/resume/config"
import { captureEvent } from "@/lib/analytics"

// The file is drawn by the server route and served as a static asset, so this is a
// plain link now: the renderer never reaches the browser bundle, and the download
// still works with JavaScript turned off. The click only records the event.
export function DownloadResumeButton() {
  return (
    <Button asChild variant="ghost" size="icon" className="print:hidden">
      <a
        href={RESUME_PDF_PATH}
        download={RESUME_PDF_FILE_NAME}
        aria-label="Download resume as PDF"
        title="Download resume (PDF)"
        onClick={() => captureEvent("resume_pdf_downloaded")}
      >
        <Download className="h-5 w-5" aria-hidden="true" />
      </a>
    </Button>
  )
}
