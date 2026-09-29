import { describe, expect, it } from "vitest"

import { slugify, SLUG_PATTERN, uniqueSlug } from "./slug"

describe("slugify", () => {
  it("lowercases and joins words with single hyphens", () => {
    expect(slugify("Hello World")).toBe("hello-world")
    expect(slugify("  Hello,  World! ")).toBe("hello-world")
  })

  it("strips accents rather than dropping the letters under them", () => {
    // Decomposing and removing the marks keeps the letter; transliterating badly
    // would turn "Café" into "caf".
    expect(slugify("Café Culture")).toBe("cafe-culture")
    expect(slugify("Ünïcôdé Tëst")).toBe("unicode-test")
  })

  it("collapses punctuation so equivalent names converge", () => {
    // This is what makes tag matching case- and punctuation-insensitive: all
    // three of these are one tag, not three.
    expect(slugify("Next.js")).toBe("next-js")
    expect(slugify("next.js")).toBe("next-js")
    expect(slugify("NEXT JS")).toBe("next-js")
  })

  it("never leaves a leading, trailing or doubled separator", () => {
    expect(slugify("--Hello--World--")).toBe("hello-world")
    expect(slugify("a / b / c")).toBe("a-b-c")
  })

  it("returns empty for input with nothing sluggable in it", () => {
    // The caller decides what to do about it; `uniqueSlug` substitutes "post".
    expect(slugify("---")).toBe("")
    expect(slugify("!!!")).toBe("")
    expect(slugify("")).toBe("")
  })

  it("always produces something the pattern accepts", () => {
    const inputs = ["Hello World", "Next.js", "Café", "  a  ", "ONE_two-THREE", "2026 in review"]

    for (const input of inputs) {
      const slug = slugify(input)
      if (slug) expect(SLUG_PATTERN.test(slug), `${input} -> ${slug}`).toBe(true)
    }
  })
})

describe("SLUG_PATTERN", () => {
  it("accepts what slugify produces", () => {
    for (const slug of ["a", "hello-world", "next-js", "post-2", "2026-in-review"]) {
      expect(SLUG_PATTERN.test(slug), slug).toBe(true)
    }
  })

  it("rejects the shapes a hand-typed slug gets wrong", () => {
    for (const slug of [
      "",
      "-leading",
      "trailing-",
      "double--hyphen",
      "Upper",
      "has space",
      "has_underscore",
      "has.dot",
      "has/slash",
      "../traversal",
    ]) {
      expect(SLUG_PATTERN.test(slug), slug).toBe(false)
    }
  })
})

describe("uniqueSlug", () => {
  it("uses the plain slug when nothing has taken it", () => {
    expect(uniqueSlug("Hello World", [])).toBe("hello-world")
    expect(uniqueSlug("Hello World", ["something-else"])).toBe("hello-world")
  })

  it("appends a suffix on collision, and keeps counting", () => {
    expect(uniqueSlug("Hello World", ["hello-world"])).toBe("hello-world-2")
    expect(uniqueSlug("Hello World", ["hello-world", "hello-world-2"])).toBe("hello-world-3")
  })

  it("skips over a gap rather than reusing a taken suffix", () => {
    // "hello-world-2" is free, so it is used even though -3 exists.
    expect(uniqueSlug("Hello World", ["hello-world", "hello-world-3"])).toBe("hello-world-2")
  })

  it("falls back to a usable slug when the title has nothing in it", () => {
    expect(uniqueSlug("!!!", [])).toBe("post")
    expect(uniqueSlug("!!!", ["post"])).toBe("post-2")
  })

  it("produces a slug the pattern accepts even after suffixing", () => {
    const slug = uniqueSlug("Hello World", ["hello-world", "hello-world-2"])
    expect(SLUG_PATTERN.test(slug)).toBe(true)
  })
})
