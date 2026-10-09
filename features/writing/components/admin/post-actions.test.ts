import { isValidElement, type ReactElement, type ReactNode } from "react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

import type { AdminPost, PostStatus } from "@/features/writing/types"

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
  setPostStatus: vi.fn(),
  deletePost: vi.fn(),
  setState: vi.fn(),
  transition: undefined as Promise<void> | undefined,
  confirm: vi.fn(),
}))
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (initial: unknown) => [initial, mocks.setState],
  useTransition: () => [false, (callback: () => Promise<void>) => (mocks.transition = callback())],
}))
vi.mock("react-router", () => ({
  useNavigate: () => (to: string) => mocks.replace(to),
  useBlocker: () => ({ state: "unblocked" }),
  useBeforeUnload: vi.fn(),
}))
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn().mockResolvedValue(undefined) }),
  useMutation: ({ mutationFn }: { mutationFn: unknown }) => ({ mutateAsync: mutationFn }),
}))
vi.mock("@/features/writing/api/client", () => ({
  adminApi: {
    setPostStatus: mocks.setPostStatus,
    deletePost: mocks.deletePost,
    createPreviewLink: vi.fn(),
  },
  adminKeys: {
    posts: ["admin", "posts"],
    overview: ["admin", "overview"],
    post: (id: string) => ["admin", "post", id],
  },
  writingKeys: { all: ["writing"] },
}))

import { PostActions } from "./post-actions"

const ID = "550e8400-e29b-41d4-a716-446655440000"

function button(label: string, status: PostStatus = "draft") {
  const post = { id: ID, title: "Sample", slug: "sample", status } as AdminPost
  const tree = PostActions({ post }) as ReactElement<{ children: ReactNode[] }>
  const found = tree.props.children.find(
    (child) =>
      isValidElement<{ children: ReactNode[] }>(child) &&
      child.type === "button" &&
      child.props.children.includes(label)
  ) as ReactElement<{ onClick: () => void }>
  expect(found).toBeDefined()
  return found.props.onClick
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.transition = undefined
  mocks.confirm.mockReturnValue(true)
  vi.stubGlobal("window", { confirm: mocks.confirm })
})
afterEach(() => vi.unstubAllGlobals())

it.each([
  ["Publish", "draft", "published"],
  ["Unpublish", "published", "draft"],
] as const)("%s updates the API cache without a page refresh", async (label, initial, target) => {
  mocks.setPostStatus.mockResolvedValue({ ok: true, postId: ID })
  button(label, initial)()
  await mocks.transition
  expect(mocks.setPostStatus).toHaveBeenCalledWith(ID, target)
  expect(mocks.refresh).not.toHaveBeenCalled()
  expect(mocks.replace).not.toHaveBeenCalled()
})

it("navigates once to the list after confirmed deletion", async () => {
  mocks.deletePost.mockResolvedValue({ ok: true })
  button("Delete")()
  await mocks.transition
  expect(mocks.confirm).toHaveBeenCalledOnce()
  expect(mocks.deletePost).toHaveBeenCalledWith(ID)
  expect(mocks.replace.mock.calls).toEqual([["/admin/posts"]])
  expect(mocks.refresh).not.toHaveBeenCalled()
})

it("does not mutate or navigate after cancelled deletion", () => {
  mocks.confirm.mockReturnValue(false)
  button("Delete")()
  expect(mocks.deletePost).not.toHaveBeenCalled()
  expect(mocks.replace).not.toHaveBeenCalled()
  expect(mocks.refresh).not.toHaveBeenCalled()
})

it("preserves the page and shows a failed status action", async () => {
  mocks.setPostStatus.mockResolvedValue({ ok: false, message: "Body required" })
  button("Publish")()
  await mocks.transition
  expect(mocks.setState).toHaveBeenCalledWith("Body required")
  expect(mocks.replace).not.toHaveBeenCalled()
  expect(mocks.refresh).not.toHaveBeenCalled()
})

it("preserves the page and shows a failed delete action", async () => {
  mocks.deletePost.mockResolvedValue({ ok: false, message: "That post no longer exists" })
  button("Delete")()
  await mocks.transition
  expect(mocks.setState).toHaveBeenCalledWith("That post no longer exists")
  expect(mocks.replace).not.toHaveBeenCalled()
  expect(mocks.refresh).not.toHaveBeenCalled()
})
