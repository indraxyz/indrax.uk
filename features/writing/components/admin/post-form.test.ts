import type { ReactElement } from "react"
import { beforeEach, expect, it, vi } from "vitest"

import type { AdminPost, ActionResult } from "@/features/writing/types"

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
  savePost: vi.fn(),
  transition: undefined as Promise<void> | undefined,
}))
// These tests exercise the form's submit handler without a DOM or the editor.
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (initial: unknown) => [initial, vi.fn()],
  useTransition: () => [false, (callback: () => Promise<void>) => (mocks.transition = callback())],
}))
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
}))
vi.mock("next/dynamic", () => ({ default: () => () => null }))
vi.mock("@/features/writing/components/admin/image-upload", () => ({ ImageUpload: () => null }))
vi.mock("@/features/writing/data/mutations", () => ({ savePost: mocks.savePost }))

import { PostForm } from "./post-form"

const ID = "550e8400-e29b-41d4-a716-446655440000"
const post: AdminPost = {
  id: ID,
  slug: "sample",
  title: "Sample",
  excerpt: null,
  coverUrl: null,
  coverAlt: null,
  publishedAt: null,
  updatedAt: "2026-01-01T00:00:00Z",
  tags: [],
  content: {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "Body" }] }],
  },
  status: "draft",
  seriesTitle: null,
  seriesDescription: null,
  seriesOrder: null,
}

async function submit(existing: AdminPost | null, result: ActionResult) {
  mocks.savePost.mockResolvedValue(result)
  const form = PostForm({ post: existing, coverUploadsConfigured: false }) as ReactElement<{
    onSubmit: (event: { preventDefault: () => void }) => void
  }>
  form.props.onSubmit({ preventDefault: vi.fn() })
  await mocks.transition
}

beforeEach(() => vi.clearAllMocks())

it("navigates once to the created post without an extra refresh", async () => {
  await submit(null, { ok: true, postId: ID })
  expect(mocks.replace.mock.calls).toEqual([[`/admin/edit/${ID}`]])
  expect(mocks.refresh).not.toHaveBeenCalled()
})

it("keeps the existing edit form after saving without requesting its page again", async () => {
  await submit(post, { ok: true, postId: ID })
  expect(mocks.replace).not.toHaveBeenCalled()
  expect(mocks.refresh).not.toHaveBeenCalled()
  expect(mocks.savePost).toHaveBeenCalledWith(
    expect.objectContaining({ id: ID, content: post.content })
  )
})

it("does not navigate away from validation errors", async () => {
  await submit(post, { ok: false, message: "That could not be saved." })
  expect(mocks.replace).not.toHaveBeenCalled()
  expect(mocks.refresh).not.toHaveBeenCalled()
})
