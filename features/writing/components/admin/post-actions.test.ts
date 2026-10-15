import { Children, isValidElement, type ReactElement, type ReactNode } from "react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

import { AlertDialog, AlertDialogAction, AlertDialogCancel } from "@/components/ui/alert-dialog"

import { Menu } from "@base-ui/react/menu"
import { PostStatusDialog } from "./post-status-dialog"
import type { AdminPost, PostStatus } from "@/features/writing/types"

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
  invalidate: vi.fn().mockResolvedValue(undefined),
  setPostStatus: vi.fn(),
  deletePost: vi.fn(),
  createPreviewLink: vi.fn(),
  open: vi.fn(),
  close: vi.fn(),
  navigateTab: vi.fn(),
  setState: vi.fn(),
  transition: undefined as Promise<void> | undefined,
}))
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useRef: (initial: unknown) => ({ current: initial }),
  useEffect: vi.fn(),
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
    createPreviewLink: mocks.createPreviewLink,
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

function button(
  label: string,
  status: PostStatus = "draft",
  onDeleted?: () => void,
  context: "editor" | "list" = "editor"
) {
  const post = { id: ID, title: "Sample", slug: "sample", status } as AdminPost
  const tree = PostActions({ post, onDeleted, context }) as ReactElement<{
    children: ReactNode[]
  }>
  function findButton(node: ReactNode): ReactElement<{ onClick: () => void }> | undefined {
    for (const child of Children.toArray(node)) {
      if (!isValidElement<{ children: ReactNode; onClick: () => void }>(child)) continue
      if (child.type === PostStatusDialog) {
        const dialog = child as unknown as ReactElement<{
          targetStatus: PostStatus
          onConfirm: () => void
        }>
        if (
          label ===
          { published: "Publish post", draft: "Unpublish post", archived: "Archive post" }[
            dialog.props.targetStatus
          ]
        )
          return { props: { onClick: dialog.props.onConfirm } } as ReactElement<{
            onClick: () => void
          }>
      }
      if (
        (child.type === "button" || child.type === AlertDialogAction || child.type === Menu.Item) &&
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
  vi.stubGlobal("location", { origin: "https://example.test" })
  vi.stubGlobal("window", { open: mocks.open })
  mocks.open.mockReturnValue({
    opener: {},
    closed: false,
    close: mocks.close,
    location: { replace: mocks.navigateTab },
  })
})

it.each([
  ["Publish post", "draft", "published"],
  ["Unpublish post", "published", "draft"],
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
  button("Delete")()
  button("Publish")()
  expect(mocks.setPostStatus).not.toHaveBeenCalled()
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
  button("Publish post")()
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

afterEach(() => vi.unstubAllGlobals())

it.each(["draft", "archived"] as const)(
  "opens a signed preview for %s without invalidating data",
  async (status) => {
    mocks.createPreviewLink.mockResolvedValue({
      ok: true,
      url: "/writing/sample/preview?token=signed",
    })
    button("Preview", status)()
    expect(mocks.open).toHaveBeenCalledWith("about:blank", "_blank")
    expect(mocks.open.mock.results[0].value.opener).toBeNull()
    await mocks.transition
    expect(mocks.createPreviewLink).toHaveBeenCalledWith(ID)
    expect(mocks.navigateTab).toHaveBeenCalledWith(
      "https://example.test/writing/sample/preview?token=signed"
    )
    expect(mocks.invalidate).not.toHaveBeenCalled()
  }
)

it("visits a published post without signing a preview", async () => {
  button("Visit", "published")()
  await mocks.transition
  expect(mocks.navigateTab).toHaveBeenCalledWith("https://example.test/writing/sample")
  expect(mocks.createPreviewLink).not.toHaveBeenCalled()
  expect(mocks.invalidate).not.toHaveBeenCalled()
})

it("closes the blank tab when preview creation fails", async () => {
  mocks.createPreviewLink.mockRejectedValue(new Error("Unavailable"))
  button("Preview")()
  await mocks.transition
  expect(mocks.close).toHaveBeenCalledOnce()
  expect(mocks.navigateTab).not.toHaveBeenCalled()
  expect(mocks.setState).toHaveBeenCalledWith(
    "The request could not be completed. Please try again."
  )
})

it("reports blocked popups without requesting a preview", () => {
  mocks.open.mockReturnValue(null)
  button("Preview")()
  expect(mocks.createPreviewLink).not.toHaveBeenCalled()
  expect(mocks.setState).toHaveBeenCalledWith(expect.stringContaining("Allow pop-ups"))
})

it("deletes a list row without replacing the list URL", async () => {
  mocks.deletePost.mockResolvedValue({ ok: true })
  button("Delete post", "draft", undefined, "list")()
  await mocks.transition
  expect(mocks.deletePost).toHaveBeenCalledWith(ID)
  expect(mocks.invalidate).toHaveBeenCalledWith({ queryKey: ["admin", "posts"] })
  expect(mocks.replace).not.toHaveBeenCalled()
})

it("confirms archiving before changing status", () => {
  button("Archive", "draft", undefined, "list")()
  expect(mocks.setState).toHaveBeenCalledWith("archived")
  expect(mocks.setState).toHaveBeenCalledWith(true)
  expect(mocks.setPostStatus).not.toHaveBeenCalled()
})
