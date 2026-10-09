import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { MemoryRouter } from "react-router"
import { expect, it } from "vitest"
import { SiteErrorPage } from "@/components/site-error-page"

it("renders a titled not-found page with the public layout and recovery links", () => {
  const html = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(SiteErrorPage)))
  expect(html).toContain("<title>Not found</title>")
  expect(html).toContain('<meta name="robots" content="noindex, nofollow"')
  expect(html).toContain("<main")
  expect(html).toContain("<header")
  expect(html).toContain("<footer")
  expect(html).toContain('href="/writing"')
})

it("keeps unexpected error pages titled without reflecting server error details", () => {
  const html = renderToStaticMarkup(
    createElement(MemoryRouter, null, createElement(SiteErrorPage, { status: 500 }))
  )
  expect(html).toContain("<title>Something went wrong</title>")
  expect(html).toContain("Please try again later")
})
