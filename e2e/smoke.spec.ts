import { expect, test } from "@playwright/test"

test.describe("the public pages", () => {
  test("renders the home hero and names the person", async ({ page }) => {
    const errors: string[] = []
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text())
    })

    await page.goto("/")

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Indra")
    await expect(page).toHaveTitle(/Indra Cahya Edytya/)
    expect(errors).toEqual([])
  })

  test("uses the same site navigation on every public page", async ({ page }) => {
    for (const path of ["/", "/resume", "/blog", "/tech-stack"]) {
      await page.goto(path)
      const navigation = page.getByRole("navigation", { name: "Site" })
      await expect(navigation.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/")
      await expect(navigation.getByRole("link", { name: "Resume" })).toHaveAttribute(
        "href",
        "/resume"
      )
      await expect(navigation.getByRole("link", { name: "Blogs" })).toHaveAttribute("href", "/blog")
      await expect(navigation.getByRole("link", { name: "Tech Stack" })).toHaveAttribute(
        "href",
        "/tech-stack"
      )
      await expect(page.getByRole("link", { name: "RSS feed" })).toHaveCount(0)
    }
  })

  test("uses one 1440px layout width across public pages", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 })

    for (const path of ["/", "/resume", "/blog", "/tech-stack"]) {
      await page.goto(path)
      const widths = await page.evaluate(() =>
        ["header > div", "main", "footer"].map(
          (selector) => document.querySelector(selector)!.getBoundingClientRect().width
        )
      )

      expect(widths, path).toEqual([1440, 1440, 1440])
    }
  })

  test("explains the site stack", async ({ page }) => {
    await page.goto("/tech-stack")

    await expect(page.getByRole("heading", { level: 1, name: "Tech Stack" })).toBeVisible()
    await expect(page.getByRole("heading", { level: 2, name: "Deployment" })).toBeVisible()
    await expect(page.getByText(/Cloudflare Workers · OpenNext/)).toBeVisible()
    await expect(page.getByText("PostHog · Sentry (planned)")).toBeVisible()
    await expect(page.getByText(/Sentry is the next planned addition/)).toBeVisible()
  })

  test("shows the spec-driven delivery lifecycle with and without motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.goto("/")

    const process = page.getByRole("region", { name: "From Ideation to Production" })
    await expect(process).toBeVisible()
    await expect(process.getByText(/spec-driven workflow/i)).toBeVisible()
    await expect(process.locator("ol li")).toHaveCount(5)
    await expect(process.locator("figure svg line")).toHaveCount(5)
    await expect(process.locator("figure svg path[pathLength]")).toHaveCount(8)
    for (const label of [
      "Specify the outcome",
      "Living context & memory",
      "Multi-agent work",
      "Layered testing",
      "Learn and update",
    ]) {
      await expect(process.getByText(new RegExp(label, "i")).first()).toBeVisible()
    }
    await expect(process.getByText(/release decision stays with a person/i)).toBeVisible()
    const trace = process.locator("figure svg path[pathLength]").first()
    expect(await trace.evaluate((path) => getComputedStyle(path).animationName)).toBe("none")

    await page.emulateMedia({ reducedMotion: "no-preference" })
    expect(await trace.evaluate((path) => getComputedStyle(path).animationName)).not.toBe("none")
  })

  test("keeps the sequence diagram readable and its arrowheads clear", async ({ page }) => {
    await page.setViewportSize({ width: 1655, height: 900 })
    await page.goto("/")

    const diagram = page.locator("section[aria-labelledby='process-heading'] figure svg")
    const message = diagram.locator("text").filter({ hasText: "Define acceptance criteria" })
    const desktop = await diagram.evaluate((svg) => {
      const arrowGaps = [...svg.querySelectorAll<SVGPathElement>("path[pathLength]")].map(
        (trace) => {
          const arrow = trace.previousElementSibling as SVGPathElement
          const arrowTip = arrow.getPointAtLength(arrow.getTotalLength())
          const traceEnd = trace.getPointAtLength(trace.getTotalLength())
          return Math.abs(arrowTip.x - traceEnd.x)
        }
      )

      return {
        width: svg.getBoundingClientRect().width,
        arrowGaps,
      }
    })
    const desktopLabelHeight = await message.evaluate(
      (label) => label.getBoundingClientRect().height
    )

    expect(desktop.width).toBeLessThanOrEqual(1100)
    expect(desktopLabelHeight).toBeGreaterThanOrEqual(12)
    expect(desktopLabelHeight).toBeLessThanOrEqual(18)
    expect(desktop.arrowGaps).toHaveLength(8)
    expect(Math.min(...desktop.arrowGaps)).toBeGreaterThanOrEqual(10)

    await page.setViewportSize({ width: 390, height: 844 })
    const mobile = await diagram.evaluate((svg) => {
      const scroller = svg.parentElement!
      return {
        width: svg.getBoundingClientRect().width,
        scrollWidth: scroller.scrollWidth,
        visibleWidth: scroller.clientWidth,
      }
    })
    const mobileLabelHeight = await message.evaluate(
      (label) => label.getBoundingClientRect().height
    )

    expect(mobile.width).toBeGreaterThanOrEqual(900)
    expect(mobile.scrollWidth).toBeGreaterThan(mobile.visibleWidth)
    expect(mobileLabelHeight).toBeGreaterThanOrEqual(11)
  })

  test("keeps the CV sections on the resume page", async ({ page }) => {
    await page.goto("/resume")

    await expect(page.getByRole("main")).toBeVisible()
    await expect(page.getByRole("navigation", { name: "Contact" })).toBeVisible()

    for (const section of ["Experiences", "Tech Stack", "Portfolio"]) {
      await expect(page.getByRole("heading", { level: 2, name: section })).toBeVisible()
    }
  })

  test("uses one card width across the mobile resume rails", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto("/resume")

    const widths = await Promise.all(
      [
        '[aria-label="Experience cards"] > div',
        '[aria-label="Tech Stack"] > div',
        '[aria-label="Portfolio"] > div',
      ].map((selector) =>
        page
          .locator(selector)
          .first()
          .evaluate((card) => card.getBoundingClientRect().width)
      )
    )
    expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(1)
  })

  test("prints the full resume with personal contact details", async ({ page }) => {
    await page.goto("/resume")
    await page.emulateMedia({ media: "print" })

    await expect(page.getByText("indracahyae@gmail.com")).toBeVisible()
    await expect(page.getByRole("heading", { name: "Experiences" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Download resume as PDF" })).toBeHidden()
  })
})
