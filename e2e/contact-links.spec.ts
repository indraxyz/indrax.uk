import { expect, test } from "@playwright/test"

import { whenHydrated } from "./support/hydration"

const EMAIL = "indracahyae@gmail.com"

test.describe("contact actions", () => {
  test("About me uses consistent section icons and restores focus on mobile and desktop", async ({
    page,
  }) => {
    for (const width of [320, 1280]) {
      await page.setViewportSize({ width, height: 700 })
      await page.goto("/resume")
      await whenHydrated(page)
      const heroIcon = await page.getByRole("link", { name: "GitHub profile" }).evaluate((node) => {
        const style = getComputedStyle(node)
        return { background: style.backgroundColor, color: style.color }
      })
      const trigger = page.getByRole("button", { name: "Open about me" })
      await trigger.click()
      const sheet = page.getByRole("dialog", { name: "About me", exact: true })
      await expect(sheet).toHaveAttribute("data-slot", "sheet-content")
      await expect(sheet).toHaveAttribute("data-side", "right")
      const icons = sheet.locator('[data-slot="section-icon"]')
      await expect(icons).toHaveCount(6)
      for (const icon of await icons.all()) {
        await expect(icon).toHaveAttribute("aria-hidden", "true")
        await expect(icon).toHaveCSS("width", "44px")
        await expect(icon).toHaveCSS("height", "44px")
        await expect(icon).toHaveCSS("background-color", heroIcon.background)
        await expect(icon).toHaveCSS("color", heroIcon.color)
      }
      await expect(sheet.getByRole("link", { name: EMAIL })).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width
      )
      await page.keyboard.press("Escape")
      await expect(sheet).toBeHidden()
      await expect(trigger).toBeFocused()
      await trigger.click()
      await sheet
        .getByRole("button", {
          name: "Close about me",
          exact: true,
        })
        .click()
      await expect(sheet).toBeHidden()
      await expect(trigger).toBeFocused()
    }
  })

  test("offers an email action in personal information", async ({ page }) => {
    for (const path of ["/", "/resume"]) {
      await page.goto(path)
      await whenHydrated(page)
      await expect(
        page.getByRole("navigation", { name: "Contact" }).getByRole("link", { name: /email/i })
      ).toHaveCount(0)
      await page.getByRole("button", { name: "Open about me" }).click()

      const email = page.getByRole("link", { name: EMAIL })

      await expect(email).toBeVisible()
      await expect(email).toHaveAttribute("href", `mailto:${EMAIL}`)
      await expect(email).toContainText(EMAIL)
    }
  })

  test("links out to LinkedIn and GitHub safely", async ({ page }) => {
    await page.goto("/")
    await whenHydrated(page)
    const contact = page.getByRole("navigation", { name: "Contact" })

    for (const [name, host] of [
      ["LinkedIn profile", "linkedin.com"],
      ["GitHub profile", "github.com"],
    ]) {
      const link = contact.getByRole("link", { name })
      await expect(link).toHaveAttribute("href", new RegExp(host.replace(".", "\\.")))
      await expect(link).toHaveAttribute("target", "_blank")
      await expect(link).toHaveAttribute("rel", /noopener/)
      await expect(link).toHaveAttribute("rel", /noreferrer/)
    }
  })

  test("is reachable by keyboard", async ({ page }) => {
    await page.goto("/")
    await whenHydrated(page)

    await page.getByRole("button", { name: "Open about me" }).click()
    const email = page.getByRole("link", { name: EMAIL })

    await email.focus()
    await expect(email).toBeFocused()
  })

  test("is the page's only GitHub control", async ({ page }) => {
    await page.goto("/")
    await whenHydrated(page)

    // The header used to carry a second "GitHub profile" link. Two links sharing
    // an accessible name is ambiguous for anyone navigating by link list, so the
    // contact row is now the single place the profile is offered.
    await expect(page.getByRole("link", { name: "GitHub profile" })).toHaveCount(1)
  })
})

for (const theme of ["light", "dark"]) {
  for (const width of [320, 1280]) {
    test(`About Me hides its heading but keeps Close available at ${width}px in ${theme}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 700 })
      await page.addInitScript((theme) => {
        localStorage.setItem("indrax-theme", theme)
        localStorage.setItem("indrax-analytics-consent", "denied")
      }, theme)
      await page.goto("/resume")
      const trigger = page.getByRole("button", { name: "Open about me", exact: true })
      await trigger.click()
      const sheet = page.getByRole("dialog", { name: "About me", exact: true })
      const pane = sheet.getByRole("region", { name: "About me details", exact: true })
      const header = pane.locator("header")
      const close = sheet.getByRole("button", { name: "Close about me", exact: true })
      await expect(pane).toHaveAttribute("data-scroll-header-scope", "")
      await expect(header).toHaveAttribute("data-scroll-hidden", "false")
      await expect(close).toHaveCSS("width", "44px")
      await expect(close).toHaveCSS("height", "44px")
      await expect(close.locator("svg")).toHaveCSS("width", "20px")
      await expect(sheet.locator('[data-slot="sheet-footer"]')).toHaveCount(0)
      const windowY = await page.evaluate(() => scrollY)
      await pane.evaluate((node) => node.scrollTo({ top: 600 }))
      await expect(header).toHaveAttribute("data-scroll-hidden", "true")
      await expect
        .poll(async () => {
          const bounds = (await header.boundingBox())!
          return bounds.y + bounds.height - (await pane.boundingBox())!.y
        })
        .toBeLessThanOrEqual(1)
      await expect(close).toBeVisible()
      const closeBounds = (await close.boundingBox())!
      const sheetBounds = (await sheet.boundingBox())!
      expect(closeBounds.y - sheetBounds.y).toBeCloseTo(12, 0)
      expect(sheetBounds.x + sheetBounds.width - closeBounds.x - closeBounds.width).toBeCloseTo(
        12,
        0
      )
      expect(await page.evaluate(() => scrollY)).toBe(windowY)
      await page.screenshot({ path: test.info().outputPath(`about-hidden-${theme}-${width}.png`) })
      await pane.evaluate((node) => node.scrollTo({ top: 520 }))
      await expect(header).toHaveAttribute("data-scroll-hidden", "false")
      await expect
        .poll(async () => (await header.boundingBox())!.y - (await pane.boundingBox())!.y)
        .toBeCloseTo(0, 0)
      await page.screenshot({ path: test.info().outputPath(`about-shown-${theme}-${width}.png`) })
      await close.focus()
      await page.keyboard.press("Enter")
      await expect(sheet).toBeHidden()
      await expect(trigger).toBeFocused()
      await trigger.click()
      await expect(pane.locator("header")).toHaveAttribute("data-scroll-hidden", "false")
      await page.keyboard.press("Escape")
      await expect(sheet).toBeHidden()
      await expect(trigger).toBeFocused()
    })
  }
}

test("About Me respects reduced motion when its own header hides", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/resume")
  await page.getByRole("button", { name: "Open about me", exact: true }).click()
  const pane = page.getByRole("region", { name: "About me details", exact: true })
  await expect(pane).toHaveCSS("transition-property", "none")
  await pane.evaluate((node) => node.scrollTo({ top: 600 }))
  await expect(pane.locator("header")).toHaveAttribute("data-scroll-hidden", "true")
  await expect(page.getByRole("button", { name: "Close about me", exact: true })).toBeVisible()
})
