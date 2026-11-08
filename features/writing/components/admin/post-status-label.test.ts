import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { expect, it } from "vitest"
import { PostStatusLabel } from "./post-status-label"

it.each(["draft", "published", "archived"] as const)(
  "retains readable %s text with a colored underline",
  (status) => {
    const html = renderToStaticMarkup(createElement(PostStatusLabel, { status }))
    expect(html).toContain(`data-post-status="${status}"`)
    expect(html).toContain(`>${status}</span>`)
    expect(html).toContain("decoration-[3px]")
    expect(html).not.toContain("variant-chip")
    expect(html).not.toContain("bg-")
  }
)
