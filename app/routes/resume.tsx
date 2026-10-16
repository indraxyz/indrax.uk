import { pageMeta } from "@/app/routes/meta"

import { ResumePage } from "@/features/resume/components/resume-page"
import { resumePageContent } from "@/features/resume/data/page"

export const meta = () =>
  pageMeta(resumePageContent.metaTitle, resumePageContent.metaDescription, "/resume", "profile")

export default function ResumeRoute() {
  return <ResumePage />
}
