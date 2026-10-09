import { expect, it } from "vitest"
import { SITE_URL } from "@/features/resume/config"
import { pageMeta } from "@/routes/meta"

it("advertises one absolute PNG for Open Graph and Twitter with shared dimensions and alt text", () => {
  const metadata = pageMeta("Article title", "Article description", "/writing/article", "article")
  const image = new URL("/writing/article/opengraph-image", SITE_URL).href
  expect(metadata).toContainEqual({
    tagName: "link",
    rel: "canonical",
    href: new URL("/writing/article", SITE_URL).href,
  })
  expect(metadata).toContainEqual({ property: "og:image", content: image })
  expect(metadata).toContainEqual({ name: "twitter:image", content: image })
  expect(metadata).toContainEqual({ property: "og:image:width", content: "1200" })
  expect(metadata).toContainEqual({ property: "og:image:height", content: "630" })
  expect(metadata).toContainEqual({ property: "og:image:type", content: "image/png" })
  expect(metadata).toContainEqual({ property: "og:image:alt", content: "Article title" })
  expect(metadata).toContainEqual({ name: "twitter:image:alt", content: "Article title" })
  expect(metadata).toContainEqual({ name: "twitter:card", content: "summary_large_image" })
})

it("allows series metadata to reuse the root card without inventing an image endpoint", () => {
  const metadata = pageMeta(
    "Series",
    "Series description",
    "/writing/series/example",
    "website",
    "/opengraph-image"
  )
  expect(metadata).toContainEqual({
    property: "og:image",
    content: new URL("/opengraph-image", SITE_URL).href,
  })
  expect(metadata).toContainEqual({
    name: "twitter:image",
    content: new URL("/opengraph-image", SITE_URL).href,
  })
})
