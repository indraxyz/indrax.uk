import { describe, expect, it } from "vitest"

import { BLOG_CONFIG } from "@/features/blog/config"

import { normaliseQuery } from "../data/queries"

/**
 * The one function standing between `?q=` and the database.
 *
 * Every other guard on this path is a bound the database enforces - the GIN
 * index, the `LIMIT`, the page clamp. This is the guard that decides whether a
 * statement runs at all, which makes it the one worth pinning down exactly
 * (threat T-11).
 *
 * Note what it deliberately does *not* do: escape anything. The value is bound as
 * a parameter and parsed by `websearch_to_tsquery`, which treats its input as a
 * search box rather than as syntax. Sanitising here would be a second, weaker
 * defence that hid the first one failing.
 */
describe("normaliseQuery", () => {
  it("keeps an ordinary search unchanged", () => {
    expect(normaliseQuery("postgres tsvector")).toBe("postgres tsvector")
  })

  it("treats nothing as nothing", () => {
    expect(normaliseQuery(undefined)).toBe("")
    expect(normaliseQuery("")).toBe("")
    expect(normaliseQuery("   ")).toBe("")
    expect(normaliseQuery("\n\t ")).toBe("")
  })

  it("collapses whitespace rather than sending it to Postgres", () => {
    expect(normaliseQuery("  full    text   search  ")).toBe("full text search")
  })

  it("accepts a query of exactly the maximum length", () => {
    const exact = "a".repeat(BLOG_CONFIG.maxQueryLength)
    expect(normaliseQuery(exact)).toBe(exact)
  })

  it("refuses one character more, and says so by returning nothing", () => {
    // Returning the empty string rather than truncating: a truncated search
    // silently answers a question nobody asked. The page renders its idle state,
    // and no statement runs.
    expect(normaliseQuery("a".repeat(BLOG_CONFIG.maxQueryLength + 1))).toBe("")
  })

  it("measures the length after collapsing, not before", () => {
    // Otherwise a query padded with spaces is refused for being long when the
    // thing actually sent is short.
    const padded = `${" ".repeat(200)}postgres${" ".repeat(200)}`
    expect(normaliseQuery(padded)).toBe("postgres")
  })

  it("passes punctuation straight through", () => {
    // `websearch_to_tsquery` is what makes this safe, and it never throws on
    // input the way `to_tsquery` does - so there is nothing to strip here, and
    // stripping would break a legitimate search for a quoted phrase.
    expect(normaliseQuery(`"exact phrase"`)).toBe(`"exact phrase"`)
    expect(normaliseQuery(`'");--`)).toBe(`'");--`)
    expect(normaliseQuery("C++ or Rust")).toBe("C++ or Rust")
  })
})
