import { postInputSchema } from "@/lib/validators/writing"
import { plainText } from "./plain-text"
import { slugify } from "./slug"
import { postFormSnapshot, type PostFormFields } from "./post-form-state"

export const AUTOSAVE_INTERVAL_MS = 60_000

/** One payload shape for manual saves and autosave validation. */
export function postFormInput(fields: PostFormFields, id?: string) {
  return {
    id,
    title: fields.title.trim(),
    slug: slugify(fields.slug) || undefined,
    excerpt: fields.excerpt.trim() || undefined,
    content: fields.body ?? { type: "doc", content: [] },
    coverUrl: fields.coverUrl.trim() || undefined,
    coverAlt: fields.coverAlt.trim() || undefined,
    status: fields.status,
    tags: fields.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
    seriesTitle: fields.seriesTitle.trim() || undefined,
    seriesDescription: fields.seriesDescription.trim() || undefined,
    seriesOrder: fields.seriesOrder.trim() ? Number(fields.seriesOrder) : undefined,
  }
}

/** Status changes remain an explicit manual action, including draft creation. */
export function canAutosave(current: PostFormFields, saved: PostFormFields, coverPending = false) {
  if (current.status !== "draft" || saved.status !== "draft") return false
  if (!coverPending && postFormSnapshot(current) === postFormSnapshot(saved)) return false
  const input = postFormInput(current)
  if (coverPending && !current.coverAlt.trim()) return false
  return postInputSchema.safeParse(input).success && plainText(input.content).length > 0
}
