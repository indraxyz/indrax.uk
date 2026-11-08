import { api } from "@/lib/api-client"
import type { ReactionInput, ReactionSummary } from "../reactions"

export const reactionKeys = {
  post: (slug: string) => ["writing", "reactions", slug] as const,
  visitor: (slug: string, visitorId: string | null) =>
    ["writing", "reactions", slug, visitorId] as const,
}

export function fetchReactions(slug: string, visitorId: string | null, signal?: AbortSignal) {
  return api
    .get(`/api/writing/posts/${encodeURIComponent(slug)}/reactions`, {
      headers: visitorId ? { "x-reaction-visitor": visitorId } : {},
      signal,
      cache: "no-store",
    })
    .json<ReactionSummary>()
}

export function putReaction(slug: string, input: ReactionInput) {
  return api
    .put(`/api/writing/posts/${encodeURIComponent(slug)}/reactions`, { json: input })
    .json<ReactionSummary>()
}
