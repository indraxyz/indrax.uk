import type { QueryClient } from "@tanstack/react-query"
import type { ActionResult, AdminPost } from "@/features/writing/types"
import { adminKeys, writingKeys } from "./client"

/** Mutation responses update the detail cache; status-only responses retain its original freshness. */
export function cachePostMutation(client: QueryClient, result: ActionResult) {
  if (!result.ok) return
  if (result.post) {
    client.setQueryData(adminKeys.post(result.post.id), result.post)
  } else if (result.postState) {
    const key = adminKeys.post(result.postState.id)
    const previous = client.getQueryState<AdminPost>(key)
    if (previous?.data) {
      client.setQueryData(
        key,
        { ...previous.data, ...result.postState },
        {
          updatedAt: previous.dataUpdatedAt,
        }
      )
      if (previous.isInvalidated)
        void client.invalidateQueries({ queryKey: key, exact: true, refetchType: "none" })
    }
  }
}

/** Mark inactive collections stale; only an actually mounted list/dashboard refetches. */
export function invalidatePostCollections(client: QueryClient) {
  return Promise.all([
    client.invalidateQueries({ queryKey: adminKeys.posts }),
    client.invalidateQueries({ queryKey: adminKeys.tags() }),
    client.invalidateQueries({ queryKey: adminKeys.overview }),
    client.invalidateQueries({ queryKey: writingKeys.all }),
  ])
}
