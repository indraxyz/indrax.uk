import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { DashboardSkeleton } from "@/admin/components/feedback/dashboard-skeleton"
import { PostsSkeleton } from "@/features/writing/components/admin/posts-skeleton"
import { PostCardsSkeleton } from "@/features/writing/components/post-skeletons"

describe("loading placeholders", () => {
  for (const [name, component] of [
    ["recent writing", createElement(PostCardsSkeleton, { rail: true })],
    ["articles", createElement(PostCardsSkeleton)],
    ["post cards", createElement(PostsSkeleton, { view: "cards" })],
    ["post table", createElement(PostsSkeleton, { view: "table" })],
    ["dashboard", createElement(DashboardSkeleton)],
  ] as const) {
    it(`announces ${name} once without adding decorative controls to keyboard navigation`, () => {
      const html = renderToStaticMarkup(component)
      expect(html.match(/role="status"/g)).toHaveLength(1)
      expect(html).toContain('aria-busy="true"')
      expect(html).toContain('aria-hidden="true"')
      expect(html).not.toMatch(/<(a|button|input|select)\b/)
      expect(html).not.toContain("tabindex")
    })
  }
})
