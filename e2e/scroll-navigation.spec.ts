import { expect, test, type Locator, type Page } from "@playwright/test"

import { whenHydrated } from "./support/hydration"

async function openPage(page: Page, site: "public" | "admin") {
  if (site === "admin") {
    await page.context().addCookies([
      {
        name: "better-auth.session_token",
        value: "browser-fixture",
        url: test.info().project.use.baseURL as string,
      },
    ])
    await page.route("**/api/admin/session", (route) =>
      route.fulfill({
        json: {
          author: { id: "fixture-author", name: "Indra", email: "author@example.test" },
          authConfigured: true,
          databaseConfigured: true,
          coverUploadsConfigured: false,
          previewConfigured: true,
        },
      })
    )
    await page.route("**/api/admin/tags", (route) => route.fulfill({ json: [] }))
    await page.goto("/admin/posts/new")
    await expect(page.getByRole("heading", { name: "New post", exact: true })).toBeVisible()
  } else {
    await page.addInitScript(() => localStorage.setItem("indrax-analytics-consent", "denied"))
    await page.goto("/resume")
    await whenHydrated(page)
    await expect(page.getByRole("navigation", { name: "Site", exact: true })).toBeVisible()
  }
  return page.locator("header").first()
}

async function expectShown(header: Locator) {
  await expect(header).toHaveAttribute("data-scroll-hidden", "false")
  await expect.poll(async () => (await header.boundingBox())!.y).toBeGreaterThanOrEqual(0)
}

async function expectHidden(header: Locator) {
  await expect(header).toHaveAttribute("data-scroll-hidden", "true")
  await expect
    .poll(async () => {
      const bounds = (await header.boundingBox())!
      return bounds.y + bounds.height
    })
    .toBeLessThanOrEqual(1)
}

for (const site of ["public", "admin"] as const) {
  test(`${site} navigation still hides after a pointer focuses its brand link`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 650 })
    const header = await openPage(page, site)
    const brand = header.getByRole("link").first()
    // Keep this page open while exercising native pointer focus on the link.
    await brand.evaluate((node) =>
      node.addEventListener("click", (event) => event.preventDefault())
    )
    await brand.click()
    await expect(brand).toBeFocused()
    expect(await brand.evaluate((node) => node.matches(":focus-visible"))).toBe(false)
    await page.mouse.move(640, 400)
    await page.mouse.wheel(0, 450)
    await expectHidden(header)
  })

  for (const width of [390, 1440]) {
    test(`${site} navigation hides downwards and returns upwards at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 650 })
      const header = await openPage(page, site)
      await expectShown(header)

      await page.mouse.move(width / 2, 400)
      await page.mouse.wheel(0, 500)
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(200)
      await expectHidden(header)

      await page.mouse.wheel(0, -100)
      await expectShown(header)
      // A small reversal must not make the navigation flicker away again.
      await page.evaluate(async () => {
        window.scrollBy({ top: 4, behavior: "instant" })
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        )
      })
      await expectShown(header)

      await page.mouse.wheel(0, 160)
      await expectHidden(header)
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }))
      await expectShown(header)
    })

    test(`${site} navigation reveals focused controls and stays visible at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 650 })
      const header = await openPage(page, site)
      await page.mouse.move(width / 2, 400)
      await page.mouse.wheel(0, 450)
      await expectHidden(header)

      // preventScroll proves that focus reveals the hidden header itself,
      // rather than succeeding only because the browser returned to page top.
      const brand = header.getByRole("link").first()
      await brand.evaluate((node) => node.focus({ preventScroll: true }))
      await expect(brand).toBeFocused()
      await expectShown(header)
      expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(200)

      await page.keyboard.press("Tab")
      expect(await header.evaluate((node) => node.contains(document.activeElement))).toBe(true)
      await page.mouse.wheel(0, 100)
      await expectShown(header)
    })
  }

  test(`${site} navigation respects reduced motion and remains printable`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 650 })
    await page.emulateMedia({ reducedMotion: "reduce" })
    const header = await openPage(page, site)
    await expect(header).toHaveCSS("transition-property", "none")
    await page.mouse.move(640, 400)
    await page.mouse.wheel(0, 450)
    await expectHidden(header)

    await page.emulateMedia({ media: "print", reducedMotion: "reduce" })
    expect(
      await header.evaluate((node) => {
        const style = getComputedStyle(node)
        return style.transform === "none" && ["none", "0px", "0px 0px"].includes(style.translate)
      })
    ).toBe(true)
  })
}

for (const width of [390, 1440]) {
  test(`admin navigation stays shown while its ${width < 768 ? "drawer" : "public menu"} is open`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 650 })
    const header = await openPage(page, "admin")
    await page.mouse.move(width / 2, 400)
    await page.mouse.wheel(0, 450)
    await expectHidden(header)
    await page.mouse.wheel(0, -100)
    await expectShown(header)

    if (width < 768) {
      await header.getByRole("button", { name: "Open admin menu" }).click()
      await expect(page.getByRole("dialog", { name: "Admin menu", exact: true })).toBeVisible()
    } else {
      await header.getByRole("button", { name: "Public", exact: true }).click()
      await page.getByRole("menuitem", { name: "Resume", exact: true }).focus()
    }
    // These controls render in portals, outside the header's focus-within tree.
    // A programmatic scroll also covers changes made while modal scroll lock is active.
    expect(await header.evaluate((node) => node.contains(document.activeElement))).toBe(false)
    await page.evaluate(async () => {
      window.scrollBy({ top: 160, behavior: "instant" })
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      )
    })
    await expectShown(header)
    await page.keyboard.press("Escape")
    if (width < 768) {
      await expect(page.getByRole("dialog", { name: "Admin menu", exact: true })).toBeHidden()
    } else {
      await expect(page.getByRole("menuitem", { name: "Resume", exact: true })).toBeHidden()
    }
    await expect(
      header.getByRole("button", {
        name: width < 768 ? "Open admin menu" : "Public",
        exact: true,
      })
    ).toBeFocused()
    await expectShown(header)
    // Dismissal restores focus to the trigger. Once focus leaves, scrolling
    // should hide the header again rather than leaving it permanently pinned.
    await header.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
    await page.mouse.move(width / 2, 400)
    await page.mouse.wheel(0, 120)
    await expectHidden(header)
  })
}

test("public navigation returns after a browser history route change", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 650 })
  const header = await openPage(page, "public")
  await header.getByRole("link", { name: "Stack", exact: true }).click()
  await expect(page).toHaveURL(/\/tech-stack$/)
  await header.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  await page.mouse.move(640, 400)
  await page.mouse.wheel(0, 450)
  await expectHidden(header)
  await page.goBack()
  await expect(page).toHaveURL(/\/resume$/)
  await expectShown(header)
  await expect(header.getByRole("link", { name: "Resume", exact: true })).toHaveAttribute(
    "aria-current",
    "page"
  )
})

test("public navigation remains visible when JavaScript is disabled", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    baseURL,
    javaScriptEnabled: false,
    viewport: { width: 390, height: 650 },
  })
  try {
    const page = await context.newPage()
    await page.goto("/resume")
    const header = page.locator("header").first()
    await page.mouse.move(195, 400)
    await page.mouse.wheel(0, 500)
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(200)
    await expectShown(header)
    await expect(header.getByRole("link", { name: "Resume", exact: true })).toBeVisible()
  } finally {
    await context.close()
  }
})
