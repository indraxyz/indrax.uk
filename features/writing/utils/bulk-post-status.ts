import { HTTPError } from "ky"
import type { ActionResult, PostStatus } from "../types"
import type { BulkResult } from "../state/post-selection"

/** Existing per-post endpoints, ordered and bounded by the caller's visible-page snapshot. */
export async function runBulkPostStatus({
  ids,
  status,
  change,
  acknowledge,
  isActive,
}: {
  ids: string[]
  status: PostStatus
  change: (id: string, status: string) => Promise<ActionResult>
  acknowledge: (result: ActionResult) => void
  isActive: () => boolean
}): Promise<BulkResult> {
  const result: BulkResult = { succeeded: [], failed: [], stopped: false, notAttempted: [] }
  const unique = [...new Set(ids)]
  for (let index = 0; index < unique.length; index++) {
    const id = unique[index]
    if (!isActive()) {
      result.stopped = true
      result.notAttempted = unique.slice(index)
      break
    }
    try {
      const outcome = await change(id, status)
      if (outcome.ok) {
        acknowledge(outcome)
        result.succeeded.push(id)
      } else
        result.failed.push({ id, message: outcome.message ?? "The post could not be updated." })
    } catch (error) {
      const unauthorized = error instanceof HTTPError && [401, 403].includes(error.response.status)
      result.failed.push({
        id,
        message: unauthorized ? "Your session has ended." : "The request failed. Please try again.",
      })
      if (unauthorized) {
        result.stopped = true
        result.unauthorized = true
        result.notAttempted = unique.slice(index + 1)
        break
      }
    }
  }
  return result
}
