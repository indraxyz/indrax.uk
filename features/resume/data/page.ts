import { personalInfo } from "./resume"

export const resumePageContent = {
  heading: "Software Engineer",
  metaTitle: `Resume - ${personalInfo.name}`,
  metaDescription: `Experience, portfolio, and technical background of ${personalInfo.name}.`,
} as const

// Section wording lives here because both the page and the PDF render it; when
// each kept its own copy the two drifted apart.
export const SECTION_COPY = {
  experiences:
    "Professional timeline across product engineering, fullstack delivery, and agentic workflow execution.",
  techStack: "Core tools and platforms used to design, build, and run digital products.",
  portfolio:
    "Selected projects that show practical delivery across web, mobile, and integrated product systems.",
} as const
