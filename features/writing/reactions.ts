export const REACTIONS = ["love", "noted", "thumbsup", "fire", "rocket"] as const
export type Reaction = (typeof REACTIONS)[number]

export const REACTION_OPTIONS: Record<Reaction, { emoji: string; label: string }> = {
  love: { emoji: "❤️", label: "Love" },
  noted: { emoji: "📝", label: "Noted" },
  thumbsup: { emoji: "👍", label: "Thumbs up" },
  fire: { emoji: "🔥", label: "Fire" },
  rocket: { emoji: "🚀", label: "Rocket" },
}

export interface ReactionSummary {
  counts: Record<Reaction, number>
  selected: Reaction[]
}

export interface ReactionInput {
  visitorId: string
  reaction: Reaction
  active: boolean
}

export const REACTION_VISITOR_KEY = "indrax-reaction-visitor-v1"

export function isReactionVisitor(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  )
}

export function parseReactionInput(value: unknown): ReactionInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const input = value as Record<string, unknown>
  const reaction = REACTIONS.find((reaction) => reaction === input.reaction)
  if (
    Object.keys(input).some((key) => !["visitorId", "reaction", "active"].includes(key)) ||
    !isReactionVisitor(input.visitorId) ||
    !reaction ||
    typeof input.active !== "boolean"
  )
    return null
  return { visitorId: input.visitorId, reaction, active: input.active }
}
