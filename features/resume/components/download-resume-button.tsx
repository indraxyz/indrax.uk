"use client"

import { Download, Loader2 } from "lucide-react"
import { useCallback, useState } from "react"

import { Button } from "@/components/ui/button"
import { personalInfo } from "@/features/resume/data/resume"
import { captureEvent } from "@/lib/analytics"

const FILE_NAME = `${personalInfo.name.replace(/\s+/g, "-")}-Resume.pdf`

export function DownloadResumeButton() {
  const [state, setState] = useState<"idle" | "working" | "error">("idle")

  const download = useCallback(async () => {
    setState("working")

    try {
      // The renderer is a large dependency and nobody needs it to read the page,
      // so it only arrives once someone actually asks for the file.
      const [{ pdf }, { ResumeDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/features/resume/pdf/resume-document"),
      ])

      const blob = await pdf(<ResumeDocument />).toBlob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")

      link.href = url
      link.download = FILE_NAME
      document.body.appendChild(link)
      link.click()
      link.remove()
      // Revoked a tick later, not inline. Chrome claims the blob synchronously on
      // the click, but Safari and Firefox read the URL on a later turn of the event
      // loop, and revoking before they get there hands the visitor an empty file.
      setTimeout(() => URL.revokeObjectURL(url), 0)

      setState("idle")
      // Recorded only once the file actually reached the visitor. A click that
      // ends in the catch below is a failure, and counting it as a download would
      // overstate the number every time the renderer falls over.
      captureEvent("resume_pdf_downloaded")
    } catch (error) {
      // Swallowing this leaves no trace of why the file never arrived.
      console.error("Resume PDF generation failed", error)
      setState("error")
    }
  }, [])

  const working = state === "working"

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={download}
      disabled={working}
      aria-busy={working}
      aria-label={working ? "Building the resume PDF" : "Download resume as PDF"}
      title={state === "error" ? "Could not build the PDF - try again" : "Download resume (PDF)"}
      className="print:hidden"
    >
      {working ? (
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
      ) : (
        <Download className="h-5 w-5" aria-hidden="true" />
      )}
      {/* Failures are silent otherwise: the icon returns to rest and nothing says why. */}
      <span aria-live="polite" className="sr-only">
        {state === "error" ? "The resume PDF could not be generated." : ""}
      </span>
    </Button>
  )
}
