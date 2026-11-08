import { expect, it } from "vitest"
import { canAutosave, postFormInput } from "./post-autosave"
import { createPostFormFields } from "./post-form-state"

const baseline = createPostFormFields(null)
const valid = {
  ...baseline,
  title: "Writing",
  body: {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "Body" }] }],
  },
}

it("autosaves only dirty valid drafts", () => {
  expect(canAutosave(valid, baseline)).toBe(true)
  for (const status of ["published", "archived"] as const) {
    expect(canAutosave({ ...valid, status }, { ...baseline, status })).toBe(false)
  }
})

it("does not save clean, reverted or incomplete forms", () => {
  expect(canAutosave(valid, valid)).toBe(false)
  expect(canAutosave(baseline, baseline)).toBe(false)
  expect(canAutosave({ ...valid, title: " " }, baseline)).toBe(false)
  expect(canAutosave({ ...valid, body: null }, baseline)).toBe(false)
  expect(canAutosave({ ...valid, seriesTitle: "Series" }, baseline)).toBe(false)
  expect(canAutosave({ ...valid, tags: "x".repeat(51) }, baseline)).toBe(false)
})

it("never automatically changes persisted publication status", () => {
  expect(canAutosave({ ...valid, status: "published" }, baseline)).toBe(false)
  expect(canAutosave(valid, { ...baseline, status: "published" })).toBe(false)
  expect(canAutosave({ ...valid, status: "archived" }, baseline)).toBe(false)
})

it("includes pending covers only once valid alt text is present", () => {
  expect(canAutosave(valid, valid, true)).toBe(false)
  const withAlt = { ...valid, coverAlt: "A cover" }
  expect(canAutosave(withAlt, withAlt, true)).toBe(true)
})

it("builds the same normalized payload for validation and saves", () => {
  expect(
    postFormInput({ ...valid, slug: " Café Test- ", tags: " React, TypeScript, " }, "id")
  ).toMatchObject({
    id: "id",
    slug: "cafe-test",
    tags: ["React", "TypeScript"],
    status: "draft",
  })
})
