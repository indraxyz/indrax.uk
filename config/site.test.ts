import { expect, it } from "vitest"
import { isIndexableSite } from "./site"

it.each([
  ["https://indrax.uk", true],
  ["https://indrax.uk/", true],
  ["https://dev.indrax.uk", false],
  ["https://www.indrax.uk", false],
  ["http://localhost:8787", false],
  ["http://indrax.uk", false],
])("indexes %s: %s", (url, expected) => {
  expect(isIndexableSite(url)).toBe(expected)
})
