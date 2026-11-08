import { expect, it } from "vitest"
import {
  createPostFormFields,
  postFormSnapshot,
  reconcilePostStatus,
  reconcileSavedFields,
} from "./post-form-state"

it.each([
  ["draft", "published"],
  ["published", "draft"],
] as const)(
  "keeps dirty content while acknowledging a %s to %s publication change",
  (before, after) => {
    const saved = { ...createPostFormFields(null), status: before, title: "Saved title" }
    const current = { ...saved, title: "Unsaved title" }
    const result = reconcilePostStatus(current, saved, after)
    expect(result.current.title).toBe("Unsaved title")
    expect(result.saved.title).toBe("Saved title")
    expect(result.current.status).toBe(after)
    expect(result.saved.status).toBe(after)
    expect(postFormSnapshot(result.current)).not.toBe(postFormSnapshot(result.saved))
  }
)

it("keeps an independently chosen status while updating the saved baseline for confirmation", () => {
  const saved = createPostFormFields(null)
  const current = { ...saved, status: "archived" as const }
  const result = reconcilePostStatus(current, saved, "published")
  expect(result.current.status).toBe("archived")
  expect(result.saved.status).toBe("published")
})

it("applies saved normalization without overwriting edits typed during a save", () => {
  const submitted = { ...createPostFormFields(null), title: " Submitted ", tags: "react" }
  const saved = {
    ...submitted,
    title: "Submitted",
    tags: "React",
    slug: "submitted",
    excerpt: "Derived",
  }
  const current = {
    ...submitted,
    title: "Later typing",
    body: { type: "doc", content: [{ type: "paragraph" }] },
  }
  const reconciled = reconcileSavedFields(current, submitted, saved)
  expect(reconciled).toMatchObject({
    title: "Later typing",
    tags: "React",
    slug: "submitted",
    excerpt: "Derived",
  })
  expect(reconciled.body).toEqual(current.body)
  expect(postFormSnapshot(reconciled)).not.toBe(postFormSnapshot(saved))
})
