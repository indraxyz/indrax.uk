import { createHash } from "node:crypto"
import { expect, it } from "vitest"
import { THEME_INIT_SCRIPT, THEME_INIT_SCRIPT_HASH } from "./theme"

it("pins the CSP hash to the exact inline theme script", () => {
  const digest = createHash("sha256").update(THEME_INIT_SCRIPT).digest("base64")
  expect(THEME_INIT_SCRIPT_HASH).toBe(`sha256-${digest}`)
})
