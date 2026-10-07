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
    await expect(page.getByText("Full-stack, APIs & Integrations", { exact: true })).toHaveCount(0)
    expect(errors).toEqual([])
  })

  test("stacks hero actions below the title on mobile home and resume", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })

    for (const path of ["/", "/resume"]) {
      await page.goto(path)

      const title = await page.getByRole("heading", { level: 1 }).boundingBox()
      const profile = await page
        .getByRole("button", { name: "Open personal information" })
        .boundingBox()
      const download = await page
        .getByRole("button", { name: "Download resume as PDF" })
        .boundingBox()

      expect(title).not.toBeNull()
      expect(profile).not.toBeNull()
      expect(download).not.toBeNull()
      expect(profile!.y).toBeGreaterThan(title!.y + title!.height)
      expect(download!.y).toBe(profile!.y)
    }
  })

  test("keeps writing search on one line and submits from mobile", async ({ page }) => {
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 })

      for (const path of ["/writing", "/writing/search"]) {
        await page.goto(path)

        const searchbox = page.getByRole("searchbox", { name: "Search articles" })
        const search = await searchbox.boundingBox()
        const button = page.getByRole("button", { name: "Search" })
        const action = await button.boundingBox()

        expect(search).not.toBeNull()
        expect(action).not.toBeNull()
        expect(action!.x).toBeGreaterThan(search!.x + search!.width)
        expect(action!.y).toBeLessThan(search!.y + search!.height)
        expect(action!.x + action!.width).toBeLessThanOrEqual(width)
        await expect(button.locator("svg")).toBeVisible()

        await searchbox.fill("typescript")
        await button.click()
        await expect(page).toHaveURL(/\/writing\/search\?q=typescript/)
      }
    }
  })

  test("uses the same site navigation on every public page", async ({ page }) => {
    for (const path of ["/", "/resume", "/writing", "/tech-stack"]) {
      await page.goto(path)
      const navigation = page.getByRole("navigation", { name: "Site" })
      await expect(navigation.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/")
      await expect(navigation.getByRole("link", { name: "Resume" })).toHaveAttribute(
        "href",
        "/resume"
      )
      await expect(navigation.getByRole("link", { name: "Writing" })).toHaveAttribute(
        "href",
        "/writing"
      )
      await expect(navigation.getByRole("link", { name: "Stack" })).toHaveAttribute(
        "href",
        "/tech-stack"
      )
      await expect(page.getByRole("link", { name: "RSS feed" })).toHaveCount(0)
    }
  })

  test("keeps public content bounded while the home hero spans the viewport", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 })

    for (const path of ["/", "/resume", "/writing", "/tech-stack"]) {
      await page.goto(path)
      const widths = await page.evaluate(
        (path) =>
          ["header > div", path === "/" ? "main > div > div" : "main", "footer"].map(
            (selector) => document.querySelector(selector)!.getBoundingClientRect().width
          ),
        path
      )

      expect(widths, path).toEqual([1440, 1440, 1440])
      if (path === "/") {
        const hero = page.locator("main > div").first()
        const surface = await hero.evaluate((element) => ({
          width: element.getBoundingClientRect().width,
          shadow: getComputedStyle(element).boxShadow,
        }))
        expect(surface.width).toBe(1600)
        const header = await page.locator("header").boundingBox()
        const heroBounds = await hero.boundingBox()
        expect(Math.abs(heroBounds!.y - header!.y - header!.height)).toBeLessThanOrEqual(1)
        // Tailwind can serialize shadow-none as several transparent shadows.
        const shadowColors = surface.shadow.match(/rgba?\([^)]+\)/g) ?? []
        expect(shadowColors.every((color) => color.endsWith(", 0)"))).toBe(true)
      }
    }
  })

  test("portfolio cards separate project details and open their repositories in a new tab", async ({
    page,
    context,
  }) => {
    const repositories = [
      ["kademix", "fullstack-kademix"],
      ["Belov", "belov"],
      ["Crimenesia", "crimenesia_web"],
      ["WisataApp", "WisataApp"],
      ["Spektra", "project-monitoring"],
      ["Parkir", "parkir"],
      ["TodoApp", "todoApp-dragdrop"],
      ["Calculator", "calculator-reactrouterv7-tailwind-vercel"],
      ["Pokedex", "pokedex"],
    ]
    await context.route("https://github.com/indraxyz/**", (route) =>
      route.fulfill({ body: "Repository" })
    )
    for (const width of [320, 1280]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto("/resume")
      const portfolio = page.getByRole("region", { name: "Portfolio", exact: true })
      const stackHeader = await page
        .getByRole("heading", { name: "Data & Storage", exact: true })
        .locator("..")
        .boundingBox()
      expect(stackHeader).not.toBeNull()
      for (const [title, repo] of repositories) {
        const card = portfolio
          .locator("div")
          .filter({ has: page.getByRole("heading", { name: title, exact: true }) })
          .filter({ has: page.getByRole("region", { name: title, exact: true }) })
          .last()
        const link = card.getByRole("link", {
          name: `${title} repository on GitHub (opens in a new tab)`,
          exact: true,
        })
        await expect(link).toHaveAttribute("href", `https://github.com/indraxyz/${repo}`)
        await expect(link).toHaveAttribute("target", "_blank")
        await expect(link).toHaveAttribute("rel", "noopener noreferrer")
        const details = card.getByRole("region", { name: title, exact: true })
        await expect(details.getByRole("heading", { name: "Features", exact: true })).toHaveCount(1)
        await expect(details.getByRole("heading", { name: "Tech stack", exact: true })).toHaveCount(
          1
        )
        await expect(details.getByRole("list")).toHaveCount(2)
        await link.scrollIntoViewIfNeeded()
        const heading = await card.getByRole("heading", { name: title, exact: true }).boundingBox()
        const header = await card.locator(":scope > div").first().boundingBox()
        const icon = await link.boundingBox()
        expect(Math.abs(header!.height - stackHeader!.height)).toBeLessThanOrEqual(1)
        expect(icon!.width).toBeGreaterThanOrEqual(44)
        expect(icon!.height).toBeGreaterThanOrEqual(44)
        expect(icon!.x).toBeGreaterThanOrEqual(heading!.x + heading!.width)
        expect(icon!.y).toBeGreaterThanOrEqual(header!.y)
        expect(icon!.y + icon!.height).toBeLessThanOrEqual(header!.y + header!.height)
        const popupPromise = page.waitForEvent("popup")
        await link.click()
        const popup = await popupPromise
        await expect(popup).toHaveURL(`https://github.com/indraxyz/${repo}`)
        await popup.close()
        await expect(page).toHaveURL(/\/resume$/)
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width
      )
    }
  })

  test("portfolio GitHub icons keep contrast on hover in both themes", async ({ page }) => {
    await page.goto("/resume")
    for (const theme of ["light", "dark"]) {
      await page.evaluate((value) => localStorage.setItem("indrax-theme", value), theme)
      await page.reload()
      for (const width of [320, 1280]) {
        await page.setViewportSize({ width, height: 900 })
        const link = page.getByRole("link", {
          name: "kademix repository on GitHub (opens in a new tab)",
          exact: true,
        })
        await link.hover()
        expect(await link.evaluate((element) => getComputedStyle(element).borderTopWidth)).toBe(
          "0px"
        )
        await expect
          .poll(
            () =>
              link.evaluate((element) => {
                const styles = getComputedStyle(element)
                const canvas = document.createElement("canvas")
                canvas.width = canvas.height = 1
                const context = canvas.getContext("2d")!
                const luminance = (color: string) => {
                  context.fillStyle = color
                  context.fillRect(0, 0, 1, 1)
                  const [r, g, b] = Array.from(context.getImageData(0, 0, 1, 1).data)
                    .slice(0, 3)
                    .map((channel) => {
                      const value = channel / 255
                      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
                    })
                  return 0.2126 * r + 0.7152 * g + 0.0722 * b
                }
                const foreground = luminance(getComputedStyle(element.querySelector("svg")!).fill)
                const background = luminance(styles.backgroundColor)
                return (
                  (Math.max(foreground, background) + 0.05) /
                  (Math.min(foreground, background) + 0.05)
                )
              }),
            { message: `${theme} theme icon contrast at ${width}px` }
          )
          .toBeGreaterThanOrEqual(3)
      }
    }
  })

  test("explains the site stack", async ({ page }) => {
    await page.goto("/tech-stack")

    await expect(page.getByRole("heading", { level: 1, name: "Tech Stack" })).toBeVisible()
    await expect(page.getByRole("heading", { level: 2, name: "Deployment" })).toBeVisible()
    await expect(page.getByText(/Cloudflare Workers · OpenNext/)).toBeVisible()
    await expect(page.getByText("PostHog · structured server logs")).toBeVisible()
    await expect(
      page.getByRole("main").getByRole("link", { name: "See my experience" })
    ).toHaveCount(0)
    await expect(page.getByRole("main").getByRole("link", { name: "Read writing" })).toHaveCount(0)
    const data = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "Data", exact: true }) })
    const deployment = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "Deployment", exact: true }) })
    await expect(data.getByText(/Cloudflare R2/)).toBeVisible()
    await expect(data.getByText(/R2 stores article media/)).toBeVisible()
    await expect(deployment).not.toContainText("R2")
    const auth = page.getByRole("region", { name: "Author access", exact: true })
    await expect(auth).toContainText("Better Auth handles GitHub OAuth sign-in, sign-out")
    await expect(auth).toContainText("database-backed sessions through the Drizzle adapter")
    await expect(auth).toContainText("numeric GitHub account allowlist")
    await expect(auth).toContainText("database sessions can be revoked")
    const local = page.getByRole("region", { name: "Local development", exact: true })
    await expect(local).toContainText("npm run dev")
    await expect(local).toContainText(".env.local")
    await expect(local).toContainText("Neon-compatible HTTP proxy")
    await expect(page.getByRole("region", { name: "Architecture overview" })).toContainText(
      "One Next.js application serves the public site and the author dashboard."
    )
    const cards = page.locator('[data-slot="stack-cards"]')
    await expect(cards.getByRole("heading", { level: 2 })).toHaveText([
      "Interface",
      "Content",
      "Data",
      "Author access",
      "Local development",
      "Quality",
      "CI/CD",
      "Deployment",
      "Measurement & monitoring",
    ])
    await expect(cards.getByText("Why:", { exact: true })).toHaveCount(9)
    const resources = page.getByRole("region", { name: "Sources", exact: true })
    for (const [name, href] of [
      ["Source on GitHub", "https://github.com/indraxyz/indrax.uk"],
      [
        "CI/CD workflow",
        "https://github.com/indraxyz/indrax.uk/blob/develop/.github/workflows/ci.yml",
      ],
      [
        "How GitHub Actions works",
        "https://docs.github.com/en/actions/get-started/understand-github-actions",
      ],
      [
        "Next.js on Cloudflare Workers",
        "https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/",
      ],
      ["Cloudflare R2 storage", "https://developers.cloudflare.com/r2/"],
      ["Workers observability", "https://developers.cloudflare.com/workers/observability/"],
    ]) {
      await expect(resources.getByRole("link", { name, exact: true })).toHaveAttribute("href", href)
    }
    for (const width of [320, 1280]) {
      await page.setViewportSize({ width, height: 900 })
      const architecture = await page
        .getByRole("region", { name: "Architecture overview" })
        .boundingBox()
      const firstCard = await cards
        .getByRole("region", { name: "Interface", exact: true })
        .boundingBox()
      expect(architecture!.y + architecture!.height).toBeLessThan(firstCard!.y)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width
      )
    }
  })

  test("writing uses the same breadcrumb-to-content spacing as the resume", async ({ page }) => {
    for (const width of [320, 1280]) {
      await page.setViewportSize({ width, height: 900 })
      const gaps: number[] = []
      for (const path of ["/resume", "/writing"]) {
        await page.goto(path)
        const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb", exact: true })
        await expect(breadcrumb).toBeVisible()
        gaps.push(
          await breadcrumb.evaluate(
            (element) =>
              element.nextElementSibling!.getBoundingClientRect().top -
              element.getBoundingClientRect().bottom
          )
        )
      }
      expect(gaps[1]).toBe(gaps[0])
    }
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

    const stack = page.getByRole("region", { name: /tech stack/i })
    await expect(stack.getByText(/Payload CMS/)).toBeVisible()
    await expect(page.getByText("Full-stack, APIs & Integrations", { exact: true })).toBeVisible()

    const juicebox = page.getByRole("listitem").filter({
      has: page.getByRole("heading", { level: 3, name: "Juicebox ID/AU, Bali" }),
    })
    await expect(juicebox.getByText(/Next\.js, Payload CMS, Vue\.js/)).toBeVisible()
    await expect(
      juicebox.getByText(
        /daily standups, progress reporting, ticket tracking, and weekly and monthly team meetings/
      )
    ).toBeVisible()
  })

  test("uses a timeline and full-width horizontal stack rail on mobile and desktop", async ({
    page,
  }) => {
    for (const width of [320, 390, 1600]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto("/resume")

      const timeline = page.getByRole("list", { name: "Experience timeline" })
      await expect(timeline).toBeVisible()
      await expect(timeline.getByRole("listitem")).not.toHaveCount(0)
      await expect(page.getByRole("region", { name: "Experience cards" })).toHaveCount(0)

      const stack = page.getByRole("region", { name: "Tech Stack", exact: true })
      const cards = stack.locator("div.variant-border")
      const dimensions = await stack.evaluate((element) => ({
        width: element.clientWidth,
        viewportWidth: document.documentElement.clientWidth,
        left: element.getBoundingClientRect().left,
        right: element.getBoundingClientRect().right,
        scrollWidth: element.scrollWidth,
      }))
      expect(Math.abs(dimensions.left)).toBeLessThanOrEqual(1)
      expect(Math.abs(dimensions.right - dimensions.viewportWidth)).toBeLessThanOrEqual(1)
      expect(dimensions.width).toBe(dimensions.viewportWidth)
      expect(dimensions.scrollWidth).toBeGreaterThan(dimensions.width)
      const cardWidths = await cards.evaluateAll((elements) =>
        elements.map((element) => element.getBoundingClientRect().width)
      )
      expect(cardWidths.length).toBeGreaterThan(1)
      expect(
        cardWidths.every((cardWidth) => cardWidth <= 384 && cardWidth < dimensions.width)
      ).toBe(true)
      await stack.focus()
      await page.keyboard.press("ArrowRight")
      await expect.poll(() => stack.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width
      )
    }
    await page.emulateMedia({ media: "print" })
    const stack = page.getByRole("region", { name: "Tech Stack", exact: true })
    const printWidths = await stack.evaluate((element) => ({
      width: element.clientWidth,
      parentWidth: element.parentElement!.clientWidth,
    }))
    expect(printWidths.width).toBe(printWidths.parentWidth)
  })

  test("scrolls the experience timeline vertically on mobile and expands it on desktop and print", async ({
    page,
  }) => {
    for (const { width, height } of [
      { width: 320, height: 640 },
      { width: 390, height: 640 },
      { width: 390, height: 480 },
    ]) {
      await page.setViewportSize({ width, height })
      await page.goto("/resume")
      const pane = page.getByRole("region", { name: "Experiences", exact: true })
      const dimensions = await pane.evaluate((element) => ({
        height: element.clientHeight,
        scrollHeight: element.scrollHeight,
        sectionHeight: element.parentElement!.getBoundingClientRect().height,
      }))
      expect(dimensions.height).toBeGreaterThan(0)
      expect(dimensions.scrollHeight).toBeGreaterThan(dimensions.height)
      expect(dimensions.sectionHeight).toBeGreaterThanOrEqual(height - 1)
      expect(dimensions.sectionHeight).toBeLessThanOrEqual(height + 1)
      await pane.focus()
      await page.keyboard.press("PageDown")
      await expect.poll(() => pane.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
      await page.keyboard.press("End")
      await expect
        .poll(() =>
          pane.evaluate(
            (element) => element.scrollHeight - element.clientHeight - element.scrollTop
          )
        )
        .toBeLessThanOrEqual(1)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width
      )
    }

    await page.setViewportSize({ width: 1280, height: 900 })
    const pane = page.getByRole("region", { name: "Experiences", exact: true })
    const desktop = await pane.evaluate((element) => ({
      height: element.clientHeight,
      scrollHeight: element.scrollHeight,
    }))
    expect(desktop.height).toBeGreaterThanOrEqual(desktop.scrollHeight)

    await page.setViewportSize({ width: 390, height: 640 })
    await page.emulateMedia({ media: "print" })
    const printed = await pane.evaluate((element) => ({
      height: element.clientHeight,
      scrollHeight: element.scrollHeight,
      cap: getComputedStyle(element.parentElement!).maxHeight,
    }))
    expect(printed.cap).toBe("none")
    expect(printed.height).toBeGreaterThanOrEqual(printed.scrollHeight)
  })

  test("prints the full resume with personal contact details", async ({ page }) => {
    await page.goto("/resume")
    await page.emulateMedia({ media: "print" })

    await expect(page.getByText("indracahyae@gmail.com")).toBeVisible()
    await expect(page.getByRole("heading", { name: "Experiences" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Download resume as PDF" })).toBeHidden()
  })
})
