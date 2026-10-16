import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, expect, it, vi } from "vitest"
import { PostCover } from "./post-cover"

afterEach(() => vi.unstubAllEnvs())

it("renders an existing local cover using the current configured port", () => {
  vi.stubEnv("MEDIA_ORIGIN", "http://localhost:5174/local-media")
  const html = renderToStaticMarkup(
    createElement(PostCover, {
      post: {
        coverUrl:
          "http://localhost:5173/local-media/covers/51dad294-2e29-40c4-9c1f-2df003c48e57.png",
        coverAlt: "Existing local cover",
      },
    })
  )
  expect(html).toContain(
    'src="http://localhost:5174/local-media/covers/51dad294-2e29-40c4-9c1f-2df003c48e57.png"'
  )
  expect(html).toContain('alt="Existing local cover"')
})
