import type { ReactElement } from "react"
import { beforeEach, expect, it, vi } from "vitest"

import type { AdminPost, ActionResult } from "@/features/writing/types"

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
  invalidate: vi.fn().mockResolvedValue(undefined),
  savePost: vi.fn(),
  transition: undefined as Promise<void> | undefined,
}))
// These tests exercise the form's submit handler without a DOM or the editor.
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (initial: unknown) => [typeof initial === "function" ? initial() : initial, vi.fn()],
  useId: () => "post-form-test",
  useRef: (initial: unknown) => ({ current: initial }),
  useEffect: vi.fn(),
  useLayoutEffect: vi.fn(),
  useTransition: () => [false, (callback: () => Promise<void>) => (mocks.transition = callback())],
}))
vi.mock("react-router", () => ({
  useNavigate: () => (to: string) => mocks.replace(to),
  useBlocker: () => ({ state: "unblocked" }),
  useBeforeUnload: vi.fn(),
}))
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: mocks.invalidate }),
  useMutation: ({ mutationFn }: { mutationFn: unknown }) => ({ mutateAsync: mutationFn }),
}))
vi.mock("@/features/writing/components/admin/image-upload", () => ({ ImageUpload: () => null }))
vi.mock("@/features/writing/api/client", () => ({
  adminApi: { savePost: mocks.savePost },
  adminKeys: {
    tags: () => ["admin", "tags"],
    post: (id: string) => ["admin", "post", id],
    posts: ["admin", "posts"],
    overview: ["admin", "overview"],
  },
  writingKeys: { all: ["writing"] },
}))

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
  const form = PostForm({
    post: existing,
    coverUploadsConfigured: false,
    children: ({ form }) => form,
  }) as ReactElement<{
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
  expect(mocks.invalidate).toHaveBeenCalledWith({ queryKey: ["admin", "tags"] })
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

it("associates the external header submit button with its form", () => {
  let headerButton: ReactElement<{ form: string; type: string }> | undefined
  const form = PostForm({
    post,
    coverUploadsConfigured: false,
    children: ({ form, saveButton }) => {
      headerButton = saveButton as ReactElement<{ form: string; type: string }>
      return form
    },
  }) as ReactElement<{ id: string }>
  expect(form.props.id).toContain("post-form-test")
  expect(headerButton?.props.form).toBe(form.props.id)
  expect(headerButton?.props.type).toBe("submit")
})

it("keeps the form and its caches unchanged after a failed save request", async () => {
  mocks.savePost.mockRejectedValue(new Error("Network unavailable"))
  const form = PostForm({
    post,
    coverUploadsConfigured: false,
    children: ({ form }) => form,
  }) as ReactElement<{ onSubmit: (event: { preventDefault: () => void }) => void }>
  form.props.onSubmit({ preventDefault: vi.fn() })
  await mocks.transition
  expect(mocks.replace).not.toHaveBeenCalled()
  expect(mocks.invalidate).not.toHaveBeenCalled()
})

it("normalizes a slug at submit even when its blur handler has not run", async () => {
  await submit({ ...post, slug: "  Café React & API!!!  " }, { ok: true, postId: ID })
  expect(mocks.savePost).toHaveBeenCalledWith(expect.objectContaining({ slug: "cafe-react-api" }))
})
