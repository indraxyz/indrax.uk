import { Children, isValidElement, type ReactElement, type ReactNode } from "react"
import { beforeEach, expect, it, vi } from "vitest"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

import type { AdminPost, PostStatus } from "@/features/writing/types"

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
  invalidate: vi.fn().mockResolvedValue(undefined),
  setPostStatus: vi.fn(),
  deletePost: vi.fn(),
  setState: vi.fn(),
  transition: undefined as Promise<void> | undefined,
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
  useQueryClient: () => ({ invalidateQueries: mocks.invalidate }),
  useMutation: ({ mutationFn }: { mutationFn: unknown }) => ({ mutateAsync: mutationFn }),
}))
vi.mock("@/features/writing/api/client", () => ({
  adminApi: {
    setPostStatus: mocks.setPostStatus,
    deletePost: mocks.deletePost,
    createPreviewLink: vi.fn(),
  },
  adminKeys: {
    tags: () => ["admin", "tags"],
    posts: ["admin", "posts"],
    overview: ["admin", "overview"],
    post: (id: string) => ["admin", "post", id],
  },
  writingKeys: { all: ["writing"] },
}))

import { PostActions } from "./post-actions"

const ID = "550e8400-e29b-41d4-a716-446655440000"

function button(label: string, status: PostStatus = "draft", onDeleted?: () => void) {
  const post = { id: ID, title: "Sample", slug: "sample", status } as AdminPost
  const tree = PostActions({ post, onDeleted }) as ReactElement<{ children: ReactNode[] }>
  function findButton(node: ReactNode): ReactElement<{ onClick: () => void }> | undefined {
    for (const child of Children.toArray(node)) {
      if (!isValidElement<{ children: ReactNode; onClick: () => void }>(child)) continue
      if (
        (child.type === "button" || child.type === AlertDialogAction) &&
        Children.toArray(child.props.children).includes(label)
      )
        return child as ReactElement<{ onClick: () => void }>
      const found = findButton(child.props.children)
      if (found) return found
    }
  }
  const found = findButton(tree)
  expect(found).toBeDefined()
  return found!.props.onClick
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.transition = undefined
})

it.each([
  ["Publish", "draft", "published"],
  ["Unpublish", "published", "draft"],
] as const)("%s updates the API cache without a page refresh", async (label, initial, target) => {
  mocks.setPostStatus.mockResolvedValue({ ok: true, postId: ID })
  button(label, initial)()
  await mocks.transition
  expect(mocks.setPostStatus).toHaveBeenCalledWith(ID, target)
  expect(mocks.invalidate).toHaveBeenCalledWith({ queryKey: ["admin", "tags"] })
  expect(mocks.refresh).not.toHaveBeenCalled()
  expect(mocks.replace).not.toHaveBeenCalled()
})

it("navigates once to the list after confirmed deletion", async () => {
  const onDeleted = vi.fn()
  mocks.deletePost.mockResolvedValue({ ok: true })
  button("Delete post", "draft", onDeleted)()
  await mocks.transition
  expect(mocks.deletePost).toHaveBeenCalledWith(ID)
  expect(mocks.invalidate).toHaveBeenCalledWith({ queryKey: ["admin", "tags"] })
  expect(mocks.replace.mock.calls).toEqual([["/admin/posts"]])
  expect(onDeleted).toHaveBeenCalledOnce()
  expect(onDeleted.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.replace.mock.invocationCallOrder[0]
  )
  expect(mocks.refresh).not.toHaveBeenCalled()
})

it("opens and cancels the confirmation without mutating or navigating", () => {
  const post = { id: ID, title: "Sample", slug: "sample", status: "draft" } as AdminPost
  const tree = PostActions({ post }) as ReactElement<{ children: ReactNode }>
  function find(
    node: ReactNode,
    type: unknown
  ): ReactElement<{ onOpenChange: (open: boolean) => void; children: ReactNode }> | undefined {
    for (const child of Children.toArray(node)) {
      if (!isValidElement<{ onOpenChange: (open: boolean) => void; children: ReactNode }>(child))
        continue
      if (child.type === type) return child
      const found = find(child.props.children, type)
      if (found) return found
    }
  }
  const dialog = find(tree, AlertDialog)
  expect(find(tree, AlertDialogTrigger)).toBeDefined()
  expect(find(tree, AlertDialogCancel)).toBeDefined()
  expect(dialog).toBeDefined()
  dialog!.props.onOpenChange(true)
  expect(mocks.setState).toHaveBeenCalledWith(true)
  dialog!.props.onOpenChange(false)
  expect(mocks.setState).toHaveBeenCalledWith(false)
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
  const onDeleted = vi.fn()
  mocks.deletePost.mockResolvedValue({ ok: false, message: "That post no longer exists" })
  button("Delete post", "draft", onDeleted)()
  await mocks.transition
  expect(mocks.setState).toHaveBeenCalledWith("That post no longer exists")
  expect(mocks.replace).not.toHaveBeenCalled()
  expect(onDeleted).not.toHaveBeenCalled()
  expect(mocks.refresh).not.toHaveBeenCalled()
})
