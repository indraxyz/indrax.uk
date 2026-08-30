import { certifications, techStacks } from "@/features/resume/data/resume"
import { groupInOrder } from "@/lib/utils"

const techStackOrder = [
  "Languages & Web Foundations",
  "Frontend Engineering",
  "Backend & API Engineering",
  "AI & Agentic Engineering",
  "Workflow Automation & n8n",
  "Data & Storage",
  "Architecture & Security",
  "Cloud & Delivery",
  "Quality & Observability",
  "Website Operations",
  "Integrations & Growth",
  "Flutter Engineering",
  "React Native Engineering",
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
