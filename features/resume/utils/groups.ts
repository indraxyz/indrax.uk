import { certifications, techStacks } from "@/features/resume/data/resume"
import { groupInOrder } from "@/lib/utils"

const techStackOrder = [
  "Languages & Web Foundations",
  "Frontend Engineering",
  "Backend & API Engineering",
  "Data & Storage",
  "Architecture & Security",
  "Website Operations",
  "Cloud & Delivery",
  "Quality & Observability",
  "Integrations & Growth",
  "Mobile & Specialized Product UI",
  "AI & Automation",
  "Design & Product Experience",
  "Project Management & Collaboration",
] as const

const certificationOrder = [
  "Claude by Anthropic",
  "ChatGPT/Codex by OpenAI",
  "AI Automations by MySkill",
] as const

export const techStackGroups = groupInOrder(
  techStacks,
  (stack) => stack.group || "Other",
  techStackOrder
)

// A certificate without an explicit group stands under its own issuer, so the
// heading always names who issued the items beneath it.
export const certificationGroups = groupInOrder(
  certifications,
  (certification) => certification.group ?? certification.issuer,
  certificationOrder
)
