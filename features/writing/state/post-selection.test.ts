import { expect, it } from "vitest"
import { createPostSelectionStore } from "./post-selection"

it("isolates mounted archives and prunes IDs removed from authoritative results", () => {
  const first = createPostSelectionStore()
  const second = createPostSelectionStore()
  first.getState().select(["a", "a", "b"])
  expect(first.getState().selectedIds).toEqual(["a", "b"])
  expect(second.getState().selectedIds).toEqual([])
  first.getState().prune(["b", "c"])
  expect(first.getState().selectedIds).toEqual(["b"])
  first.getState().toggle("b")
  expect(first.getState().selectedIds).toEqual([])
})

it("guards duplicate operations and selection changes, retaining only unconfirmed IDs", () => {
  const store = createPostSelectionStore()
  store.getState().select(["a", "b"])
  expect(store.getState().begin()).toBe(true)
  expect(store.getState().begin()).toBe(false)
  store.getState().toggle("c")
  store.getState().select([])
  expect(store.getState().selectedIds).toEqual(["a", "b"])
  store.getState().finish({
    succeeded: ["a"],
    failed: [{ id: "b", message: "Retry" }],
    stopped: false,
    notAttempted: [],
  })
  expect(store.getState().selectedIds).toEqual(["b"])
  expect(store.getState().pending).toBe(false)
})

it("notifies narrow membership selections only when their value changes", () => {
  const store = createPostSelectionStore()
  const samples: boolean[] = []
  let previous = false
  store.subscribe((state) => {
    const next = state.selectedIds.includes("a")
    if (next !== previous) samples.push(next)
    previous = next
  })
  store.getState().toggle("b")
  store.getState().toggle("a")
  store.getState().begin()
  expect(samples).toEqual([true])
})
