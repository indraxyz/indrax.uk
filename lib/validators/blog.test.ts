import { describe, expect, it } from "vitest"

import { LIMITS, postIdSchema, postInputSchema, slugSchema } from "./blog"

/**
 * The schema every write goes through.
 *
 * The fields it *refuses* are as much the point as the ones it accepts:
 * `readingTime`, `publishedAt`, `createdAt` and `updatedAt` are computed
 * server-side, so a client offering them has to be ignored rather than trusted.
 */
const validDocument = { type: "doc", content: [{ type: "paragraph" }] }

const base = {
  title: "A post",
  content: validDocument,
  status: "draft" as const,
  tags: [],
}

describe("postIdSchema", () => {
  it("accepts a uuid", () => {
    expect(postIdSchema.safeParse("0f441098-c606-421b-a951-c61d22e07930").success).toBe(true)
  })

  it("refuses anything a uuid column would raise on", () => {
    // Postgres raises 22P02 rather than simply not matching, so this is what
    // keeps /admin/edit/anything a not-found instead of a 500.
    for (const id of ["", "anything", "123", "0f441098-c606-421b-a951", "' OR 1=1--"]) {
      expect(postIdSchema.safeParse(id).success, id).toBe(false)
    }
  })
})

describe("slugSchema", () => {
  it("accepts the shape slugify produces", () => {
    expect(slugSchema.safeParse("hello-world").success).toBe(true)
  })

  it("refuses uppercase, spaces, and traversal", () => {
    for (const slug of ["Hello", "has space", "../etc", "trailing-", "double--hyphen"]) {
      expect(slugSchema.safeParse(slug).success, slug).toBe(false)
    }
  })

  it("refuses a slug past the length cap", () => {
    expect(slugSchema.safeParse("a".repeat(LIMITS.slug + 1)).success).toBe(false)
  })
})

describe("postInputSchema", () => {
  it("accepts a minimal valid post and defaults its status", () => {
    const parsed = postInputSchema.safeParse({ title: "A post", content: validDocument })

    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.status).toBe("draft")
      expect(parsed.data.tags).toEqual([])
    }
  })

  it("requires a title", () => {
    expect(postInputSchema.safeParse({ ...base, title: "" }).success).toBe(false)
    expect(postInputSchema.safeParse({ ...base, title: "   " }).success).toBe(false)
  })

  it("requires the body to be a document", () => {
    for (const content of [undefined, null, "markdown", {}, { type: "paragraph" }]) {
      expect(postInputSchema.safeParse({ ...base, content }).success, String(content)).toBe(false)
    }
  })

  it("refuses a body past the size cap", () => {
    const huge = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "x".repeat(LIMITS.content) }] },
      ],
    }

    expect(postInputSchema.safeParse({ ...base, content: huge }).success).toBe(false)
  })

  it("refuses a status outside the three it knows", () => {
    expect(postInputSchema.safeParse({ ...base, status: "publish" }).success).toBe(false)
    expect(postInputSchema.safeParse({ ...base, status: "PUBLISHED" }).success).toBe(false)
  })

  it("refuses a cover without alt text", () => {
    // An image nobody can see is worse than no image, and save is the last point
    // at which it is cheap to fix (PRD US-3.6).
    const parsed = postInputSchema.safeParse({
      ...base,
      coverUrl: "https://media.example.com/a.png",
    })

    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      expect(parsed.error.flatten().fieldErrors.coverAlt).toBeTruthy()
    }
  })

  it("accepts a cover with alt text", () => {
    expect(
      postInputSchema.safeParse({
        ...base,
        coverUrl: "https://media.example.com/a.png",
        coverAlt: "A photograph",
      }).success
    ).toBe(true)
  })

  it("refuses a cover that is not an absolute URL", () => {
    expect(
      postInputSchema.safeParse({ ...base, coverUrl: "/local.png", coverAlt: "x" }).success
    ).toBe(false)
  })

  it("caps the number of tags", () => {
    const tags = Array.from({ length: 11 }, (_, index) => `tag-${index}`)
    expect(postInputSchema.safeParse({ ...base, tags }).success).toBe(false)
  })

  it("silently drops fields the server owns", () => {
    // Not an error - just absent from the parsed output, so a caller cannot
    // assert a reading time, a publication date or a creation date.
    const parsed = postInputSchema.safeParse({
      ...base,
      readingTime: 999,
      publishedAt: "1999-01-01",
      createdAt: "1999-01-01",
      viewCount: 5000,
    })

    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data).not.toHaveProperty("readingTime")
      expect(parsed.data).not.toHaveProperty("publishedAt")
      expect(parsed.data).not.toHaveProperty("createdAt")
      expect(parsed.data).not.toHaveProperty("viewCount")
    }
  })
})
