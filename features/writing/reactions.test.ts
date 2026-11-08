import { expect, it } from "vitest"
import { isReactionVisitor, parseReactionInput, REACTIONS } from "./reactions"

const visitorId = "550e8400-e29b-41d4-a716-446655440000"

it.each(REACTIONS)("accepts explicit desired state for %s", (reaction) => {
  for (const active of [true, false]) {
    const input = { visitorId, reaction, active }
    expect(parseReactionInput(input)).toEqual(input)
  }
})

it.each([
  null,
  [],
  {},
  { visitorId, reaction: "heart", active: true },
  { visitorId, reaction: "love", active: "true" },
  { visitorId: "not-a-uuid", reaction: "love", active: true },
  { visitorId, reaction: "love", active: true, postId: "extra" },
])("rejects invalid reaction input: %j", (input) => {
  expect(parseReactionInput(input)).toBeNull()
})

it("accepts only bounded version-four UUID browser identities", () => {
  expect(isReactionVisitor(visitorId)).toBe(true)
  expect(isReactionVisitor(visitorId.toUpperCase())).toBe(true)
  expect(isReactionVisitor(visitorId.repeat(100))).toBe(false)
  expect(isReactionVisitor("550e8400-e29b-11d4-a716-446655440000")).toBe(false)
})
