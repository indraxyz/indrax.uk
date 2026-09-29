import type { Metadata } from "next"

import { ResumePage } from "@/features/resume/components/resume-page"
import { personalInfo } from "@/features/resume/data/resume"

const title = `Resume - ${personalInfo.name}`
const description = `Experience, portfolio, and technical background of ${personalInfo.name}.`

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/resume" },
  openGraph: { type: "profile", url: "/resume", title, description },
}

export default function ResumeRoute() {
  return <ResumePage />
}
