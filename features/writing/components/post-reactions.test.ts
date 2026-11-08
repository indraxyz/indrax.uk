import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { afterEach, expect, it, vi } from "vitest"
import { PostReactions, readReactionVisitor } from "./post-reactions"
import { REACTION_VISITOR_KEY } from "../reactions"

afterEach(() => vi.unstubAllGlobals())

it("renders accessible reaction buttons without invented counts or a server-side fetch", () => {
  const fetch = vi.fn()
  vi.stubGlobal("fetch", fetch)
  const html = renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client: new QueryClient() },
      createElement(PostReactions, { slug: "article" })
    )
  )
  expect(html.match(/aria-pressed="false"/g)).toHaveLength(5)
  expect(html.match(/count unavailable/g)).toHaveLength(5)
  expect(html).toContain('aria-label="Reader reactions"')
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
