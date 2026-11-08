import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { afterEach, expect, it, vi } from "vitest"
import { PostReactions, readReactionVisitor } from "./post-reactions"
import { REACTION_VISITOR_KEY } from "../reactions"

afterEach(() => vi.unstubAllGlobals())

it("renders only the accessible picker trigger without invented counts or a server-side fetch", () => {
  const fetch = vi.fn()
  vi.stubGlobal("fetch", fetch)
  const html = renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client: new QueryClient() },
      createElement(PostReactions, {
        slug: "article",
        children: ({ trigger, summary }) => createElement("div", null, trigger, summary),
      })
    )
  )
  expect(html).toContain('aria-label="Add reaction"')
  expect(html).not.toContain('aria-label="Reader reactions"')
  expect(html).not.toContain("aria-pressed")
  expect(html).not.toContain("count unavailable")
  expect(html).toContain('role="status"')
  expect(fetch).not.toHaveBeenCalled()
})

it("does not create identity while reading, including blocked storage", () => {
  const getItem = vi.fn(() => null)
  const setItem = vi.fn()
  vi.stubGlobal("window", { localStorage: { getItem, setItem } })
  expect(readReactionVisitor()).toBeNull()
  expect(getItem).toHaveBeenCalledWith(REACTION_VISITOR_KEY)
  expect(setItem).not.toHaveBeenCalled()
  getItem.mockImplementation(() => {
    throw new Error("blocked")
  })
  expect(readReactionVisitor()).toBeNull()
})

it("shows only positive reaction counts from the shared query cache", () => {
  const client = new QueryClient()
  client.setQueryData(["writing", "reactions", "article", null], {
    counts: { love: 2, noted: 0, thumbsup: 0, fire: 0, rocket: 1 },
    selected: ["love"],
  })
  const html = renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client },
      createElement(PostReactions, {
        slug: "article",
        children: ({ trigger, summary }) => createElement("div", null, trigger, summary),
      })
    )
  )
  expect(html).toContain('aria-label="Love: 2 reactions"')
  expect(html).toContain('aria-label="Rocket: 1 reaction"')
  expect(html).not.toContain("📝")
  expect(html).not.toContain("👍")
  expect(html).not.toContain("🔥")
  expect(html.match(/aria-pressed=/g)).toHaveLength(2)
})
