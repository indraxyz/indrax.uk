import { expect, it, vi } from "vitest"

const renderer = vi.hoisted(() => ({ html: "" }))
vi.mock("@tiptap/static-renderer/pm/html-string", () => ({
  renderToHTMLString: () => renderer.html,
}))

import { renderDocument } from "./content"

const canonical = "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"
const render = async (html: string) => {
  renderer.html = html
  return (await renderDocument({ type: "doc" })).html
}

it("revalidates iframe destinations independently of the editor's node renderer", async () => {
  for (const src of [
    "https://evil.test/embed/dQw4w9WgXcQ",
    "https://www.youtube-nocookie.com.evil.test/embed/dQw4w9WgXcQ",
    "https://www.youtube-nocookie.com/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com/embed/dQw4w9WgXcQ",
    "https://user@www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    "javascript:alert(1)",
    "//www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    "/embed/dQw4w9WgXcQ",
    `${canonical}/more`,
  ]) {
    const html = await render(
      `<div data-youtube-video><iframe src="${src}"></iframe></div><p>Retained prose</p>`
    )
    expect(html).toBe("<p>Retained prose</p>")
  }
})

it("drops unmarked frames and reconstructs only the narrow approved player attributes", async () => {
  const html = await render(
    `<iframe src="${canonical}"></iframe><div data-youtube-video data-align="right" style="position:fixed"><iframe src="${canonical}?autoplay=1&amp;start=10&amp;enablejsapi=1" title="Demo" srcdoc="evil" onload="alert(1)" allow="camera; microphone; autoplay" referrerpolicy="no-referrer" width="99999"></iframe><script>alert(1)</script></div>`
  )
  expect(html.match(/<iframe /g)).toHaveLength(1)
  expect(html).toContain(`src="${canonical}?start=10"`)
  expect(html).toContain('data-align="right"')
  expect(html).toContain('title="Demo"')
  expect(html).toContain('referrerpolicy="strict-origin-when-cross-origin"')
  expect(html).toContain('allow="encrypted-media; picture-in-picture; fullscreen"')
  expect(html).not.toMatch(
    /position:|onload=|srcdoc=| width=|camera|microphone|autoplay|enablejsapi|<script/
  )
})

it("rebuilds size declarations from bounded metadata while discarding all stored CSS", async () => {
  const html = await render(
    `<div data-youtube-video data-video-width="360" style="width:99999px;position:fixed"><iframe src="${canonical}"></iframe></div>`
  )
  expect(html).toContain('data-video-width="360"')
  expect(html).toContain('style="width: 360px"')
  expect(html).not.toContain("position:")
  const full = await render(
    `<div data-youtube-video data-video-width="calc(100vw)" data-full-width="true"><iframe src="${canonical}"></iframe></div>`
  )
  expect(full).toContain('data-video-width="640"')
  expect(full).toContain('style="width: 100%"')
  const invalid = await render(
    `<div data-youtube-video data-video-width="999999" data-full-width="yes"><iframe src="${canonical}"></iframe></div>`
  )
  expect(invalid).toContain('style="width: 640px"')
  expect(invalid).not.toContain("data-full-width")
})
