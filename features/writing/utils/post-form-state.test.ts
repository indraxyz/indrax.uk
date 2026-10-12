import { expect, it } from "vitest"
import { createPostFormFields, postFormSnapshot, reconcilePostStatus } from "./post-form-state"

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
