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
        return { background: style.backgroundColor, color: style.color, shadow: style.boxShadow }
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
        await expect(icon).toHaveCSS("box-shadow", heroIcon.shadow)
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
          name: width < 640 ? "Close about me" : "Close",
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
