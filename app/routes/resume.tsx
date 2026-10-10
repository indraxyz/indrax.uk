import { pageMeta } from "@/app/routes/meta"

import { ResumePage } from "@/features/resume/components/resume-page"
import { personalInfo } from "@/features/resume/data/resume"

const title = `Resume - ${personalInfo.name}`
const description = `Experience, portfolio, and technical background of ${personalInfo.name}.`

export const meta = () => pageMeta(title, description, "/resume", "profile")

export default function ResumeRoute() {
  return <ResumePage />
}
