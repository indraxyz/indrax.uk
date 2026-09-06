import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"

import { SEEDED_POST_SLUG, SEEDED_TAG_SLUG } from "./support/constants"

/**
 * The accessibility floor, enforced rather than remembered.
 *
 * NFR-3 asks for zero violations at `serious` or `critical`, and NFR-4 for
 * WCAG 2.2 AA in **both** themes. This ran by hand for two phases and found four
 * things nothing else did: task-list checkboxes with no label, a syntax theme
 * failing contrast at 3.37:1, a tag count faded below 4.5:1, and list pages with
 * no `<h1>` at all. Every one of those was invisible to the type checker, the
 * linter and the rest of the suite.
 *
 * Both themes, because a token that is legible on white can be illegible on the
 * dark surface and nothing about the markup would change. `moderate` and `minor`
 * findings are reported but do not fail: they are worth seeing and not worth
 * blocking a merge over.
 */
const PATHS = [
  { name: "resume", path: "/" },
  { name: "archive", path: "/blog" },
  { name: "article", path: `/blog/${SEEDED_POST_SLUG}` },
  { name: "tag", path: `/blog/tag/${SEEDED_TAG_SLUG}` },
  { name: "not found", path: "/blog/no-such-article" },
  { name: "sign in", path: "/admin/login" },
]

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]

async function scan(page: Page) {
  return new AxeBuilder({ page }).withTags(TAGS).analyze()
}

for (const theme of ["light", "dark"] as const) {
  test.describe(`accessibility (${theme})`, () => {
    for (const { name, path } of PATHS) {
      test(`${name} has no serious or critical violations`, async ({ page }) => {
        await page.addInitScript((value) => {
          window.localStorage.setItem("indrax-theme", value)
        }, theme)

        await page.goto(path)
        // Article pages attach their copy buttons after load; scanning before that
        // would miss controls a reader can actually reach.
        await page.waitForLoadState("networkidle")

        const results = await scan(page)
        const blocking = results.violations.filter(
          (violation) => violation.impact === "serious" || violation.impact === "critical"
        )

        // Named in the failure, so a regression says which rule and where rather
        // than just a count.
        expect(
          blocking.map((violation) => ({
            id: violation.id,
            impact: violation.impact,
            nodes: violation.nodes.map((node) => node.target.join(" ")),
          }))
        ).toEqual([])
      })
    }
  })
}
