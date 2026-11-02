import { describe, expect, it } from "vitest"
import { unified } from "unified"
import rehypeParse from "rehype-parse"
import type { Element } from "hast"

import type { PostDocument } from "@/features/writing/types"
import { renderDocument } from "./content"

const src = "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"
const video = (attrs: Record<string, unknown>): PostDocument => ({ type: "youtube", attrs })
const render = (...content: PostDocument[]) =>
  renderDocument({ type: "doc", content }).then(({ html }) => html)

describe("renderDocument — YouTube embeds", () => {
  it("renders titled, lazy privacy-enhanced video between existing blocks", async () => {
    const html = await render(
      { type: "paragraph", content: [{ type: "text", text: "Before" }] },
      video({
        src: "https://youtu.be/dQw4w9WgXcQ?t=30",
        title: "Demo walkthrough",
        textAlign: "right",
      }),
      { type: "image", attrs: { src: "https://example.test/image.png", alt: "After" } }
    )
    expect(html).toMatch(/Before.*data-youtube-video.*iframe.*alt="After"/)
    expect(html).toContain(`src="${src}?start=30"`)
    expect(html).toContain('data-align="right"')
    expect(html).toContain('title="Demo walkthrough"')
    expect(html).toContain('loading="lazy"')
    expect(html).toContain('referrerpolicy="strict-origin-when-cross-origin"')
    expect(html).toContain('allow="encrypted-media; picture-in-picture; fullscreen"')
    expect(html).toContain("allowfullscreen")
    expect(html).toContain('style="width: 640px"')
  })

  it("reconstructs permissions and dimensions instead of trusting node attributes", async () => {
    const html = await render(
      video({
        src: `${src}?autoplay=1&enablejsapi=1&origin=https://evil.test&start=10`,
        title: '<img src=x onerror="alert(1)">',
        width: "99999",
        height: -1,
        allow: "camera; microphone; autoplay",
        srcdoc: "<script>alert(1)</script>",
        onload: "alert(1)",
        style: "position:fixed",
        textAlign: "justify",
      })
    )
    expect(html).toContain(`src="${src}?start=10"`)
    const tree = unified().use(rehypeParse, { fragment: true }).parse(html)
    const wrapper = tree.children[0] as Element
    const iframe = wrapper.children[0] as Element
    expect(iframe.tagName).toBe("iframe")
    expect(iframe.children).toEqual([])
    expect(iframe.properties.title).toBe('<img src=x onerror="alert(1)">')
    expect(html).not.toMatch(/<script| srcdoc=| onload=|position:| width=| height=|data-align=/)
    expect(html).not.toContain("camera")
    expect(html).not.toContain("microphone")
    expect(html).not.toContain("autoplay")
    expect(html).not.toContain("enablejsapi")
    expect(html).not.toContain("evil.test")
  })

  it.each([
    "javascript:alert(1)",
    "https://evil.test/embed/dQw4w9WgXcQ",
    "https://www.youtube-nocookie.com.evil.test/embed/dQw4w9WgXcQ",
    "https://www.youtube-nocookie.com/embed/invalid",
    "http://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    "https://user@www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
  ])("omits malformed video nodes rather than creating arbitrary frames: %s", async (url) => {
    const html = await render(video({ src: url }))
    expect(html).not.toContain("iframe")
    expect(html).not.toContain("data-youtube-video")
  })

  it("provides a default title and leaves older documents unchanged", async () => {
    expect(await render(video({ src, title: "  " }))).toContain('title="YouTube video player"')
    expect(
      await render({ type: "paragraph", content: [{ type: "text", text: "Existing prose" }] })
    ).toBe("<p>Existing prose</p>")
  })
})

it("persists bounded video widths with an automatic 16:9 height", async () => {
  const html = await render(video({ src, width: 384, height: 99999, textAlign: "center" }))
  expect(html).toContain('data-video-width="384"')
  expect(html).toContain('style="width: 384px"')
  expect(html).toContain('data-align="center"')
  expect(html).not.toContain(" height=")
})

it("supports full content width without trusting arbitrary stored styles", async () => {
  const html = await render(
    video({ src, width: 384, fullWidth: true, style: "height:99999px;position:fixed" })
  )
  expect(html).toContain('data-video-width="384"')
  expect(html).toContain('data-full-width="true"')
  expect(html).toContain('style="width: 100%"')
  expect(html).not.toContain("99999")
  expect(html).not.toContain("position:")
  expect(await render(video({ src, fullWidth: "true" }))).not.toContain("data-full-width")
})

it.each([0, -1, 31, 3841, 1.5, "calc(100vw)", "640;position:fixed", null])(
  "replaces invalid video width metadata with the safe default: %s",
  async (width) => {
    const html = await render(video({ src, width }))
    expect(html).toContain('data-video-width="640"')
    expect(html).toContain('style="width: 640px"')
  }
)
