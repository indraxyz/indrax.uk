import { QueryClient } from "@tanstack/react-query"
import { afterEach, expect, it, vi } from "vitest"
import type { AdminPost } from "../types"
import { adminKeys } from "./client"
import { cachePostMutation, invalidatePostCollections } from "./mutation-cache"

const clients: QueryClient[] = []
function client() {
  const result = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000 } } })
  clients.push(result)
  return result
}
afterEach(() => clients.splice(0).forEach((client) => client.clear()))
const post: AdminPost = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  slug: "saved",
  title: "Saved",
  status: "draft",
  excerpt: "Derived excerpt",
  content: { type: "doc", content: [] },
  coverUrl: null,
  coverAlt: null,
  publishedAt: null,
  updatedAt: "2026-11-08T00:00:00Z",
  tags: [],
  seriesTitle: null,
  seriesDescription: null,
  seriesOrder: null,
}
it("seeds a fresh detail snapshot reused by navigation without a detail request", async () => {
  const queryClient = client()
  const queryFn = vi.fn()
  cachePostMutation(queryClient, { ok: true, postId: post.id, post })
  queryClient.setQueryData(adminKeys.posts, [])
  await invalidatePostCollections(queryClient)
  await queryClient.prefetchQuery({ queryKey: adminKeys.post(post.id), queryFn })
  expect(queryFn).not.toHaveBeenCalled()
  expect(queryClient.getQueryData(adminKeys.post(post.id))).toEqual(post)
  expect(queryClient.getQueryState(adminKeys.posts)?.isInvalidated).toBe(true)
})
it("patches status without falsely refreshing stale or invalidated article content", async () => {
  const queryClient = client()
  const key = adminKeys.post(post.id)
  const updatedAt = Date.now() - 120_000
  queryClient.setQueryData(key, post, { updatedAt })
  await queryClient.invalidateQueries({ queryKey: key, refetchType: "none" })
  cachePostMutation(queryClient, {
    ok: true,
    postState: {
      id: post.id,
      status: "published",
      publishedAt: "2026-11-08T00:00:00Z",
      updatedAt: "2026-11-08T01:00:00Z",
    },
  })
  expect(queryClient.getQueryData<AdminPost>(key)).toMatchObject({
    status: "published",
    content: post.content,
  })
  expect(queryClient.getQueryState(key)?.dataUpdatedAt).toBe(updatedAt)
  expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true)
})
it("does not fabricate a full editor record from status-only data", () => {
  const queryClient = client()
  cachePostMutation(queryClient, {
    ok: true,
    postState: {
      id: post.id,
      status: "published",
      publishedAt: null,
      updatedAt: post.updatedAt,
    },
  })
  expect(queryClient.getQueryData(adminKeys.post(post.id))).toBeUndefined()
})
