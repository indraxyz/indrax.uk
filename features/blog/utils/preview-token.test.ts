import { beforeAll, describe, expect, it } from "vitest"

import { createPreviewToken, PREVIEW_TTL_MS, verifyPreviewToken } from "./preview-token"

/**
 * The token is the only thing standing between an unpublished draft and anyone
 * holding a URL, so these are the assertions that matter most in the file.
 *
 * The end-to-end suite drives the same logic through the admin and a fresh
 * browser, which proves it works in place. This proves the parts a browser
 * cannot reach: the exact expiry boundary, a signature altered by one character,
 * and the shapes of malformed input that should all collapse to the same answer.
 */
beforeAll(() => {
  process.env.BETTER_AUTH_SECRET = "a-secret-for-unit-tests-only-000000000000"
})

const SLUG = "a-draft-post"

describe("createPreviewToken", () => {
  it("produces a payload and a signature, separated by a dot", () => {
    // Not asserting the exact encoding - that is an implementation detail - only
    // the shape `verifyPreviewToken` has to be able to split.
    return createPreviewToken(SLUG).then((token) => {
      expect(token.split(".")).toHaveLength(2)
      expect(token).not.toContain("+")
      expect(token).not.toContain("/")
      expect(token).not.toContain("=")
    })
  })

  it("does not put the secret anywhere in the token", async () => {
    const token = await createPreviewToken(SLUG)
    expect(token).not.toContain(process.env.BETTER_AUTH_SECRET)
  })

  it("carries the slug, which is not a secret", async () => {
    // Stated as a property rather than a leak: whoever holds the token was given
    // the URL, so the slug is something they already know.
    const token = await createPreviewToken(SLUG)
    const [payload] = token.split(".")
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"))

    expect(decoded.startsWith(`${SLUG}.`)).toBe(true)
  })
})

describe("verifyPreviewToken", () => {
  it("accepts a token it just made", async () => {
    expect(await verifyPreviewToken(await createPreviewToken(SLUG), SLUG)).toBe(true)
  })

  it("refuses a token minted for a different post", async () => {
    // The signature is recomputed from the *requested* slug, so a token cannot be
    // repointed at another draft (threat T-4).
    const token = await createPreviewToken(SLUG)
    expect(await verifyPreviewToken(token, "some-other-post")).toBe(false)
  })

  it("refuses a token whose signature has been altered by one character", async () => {
    const token = await createPreviewToken(SLUG)
    const flipped = token.slice(0, -1) + (token.endsWith("A") ? "B" : "A")

    expect(await verifyPreviewToken(flipped, SLUG)).toBe(false)
  })

  it("refuses a token whose payload has been altered", async () => {
    // Re-encoding a longer expiry and keeping the original signature.
    const token = await createPreviewToken(SLUG)
    const [, signature] = token.split(".")
    const forged = `${btoa(`${SLUG}.${Date.now() + 10 * PREVIEW_TTL_MS}`)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "")}.${signature}`

    expect(await verifyPreviewToken(forged, SLUG)).toBe(false)
  })

  it("refuses an expired token", async () => {
    const token = await createPreviewToken(SLUG, Date.now() - 2 * PREVIEW_TTL_MS)
    expect(await verifyPreviewToken(token, SLUG)).toBe(false)
  })

  it("holds the expiry boundary in both directions", async () => {
    const now = Date.now()
    const token = await createPreviewToken(SLUG, now)

    // Valid one millisecond before it expires...
    expect(await verifyPreviewToken(token, SLUG, now + PREVIEW_TTL_MS - 1)).toBe(true)
    // ...and not at the instant it does. `<=` rather than `<` in the check.
    expect(await verifyPreviewToken(token, SLUG, now + PREVIEW_TTL_MS)).toBe(false)
  })

  it("refuses every shape of malformed input, without throwing", async () => {
    const malformed = [
      undefined,
      "",
      ".",
      "onlyonepart",
      "not-base64!!.signature",
      `${btoa("no-dot-in-payload")}.signature`,
      `${btoa("slug.notanumber")}.signature`,
      "..",
    ]

    for (const token of malformed) {
      // Every failure is the same answer, because the route turns all of them
      // into the same 404 a draft gives anyone else.
      expect(await verifyPreviewToken(token, SLUG), String(token)).toBe(false)
    }
  })

  it("is not fooled by a slug containing the separator", async () => {
    // Slugs cannot contain dots by `SLUG_PATTERN`, but the split has to be
    // unambiguous regardless of what it is handed.
    const token = await createPreviewToken(SLUG)
    expect(await verifyPreviewToken(token, `${SLUG}.1700000000000`)).toBe(false)
  })
})
