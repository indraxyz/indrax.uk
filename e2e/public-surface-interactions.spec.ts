import { contrastRatio } from "./support/visual-controls"
import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Locator, type Page } from "@playwright/test"

async function pressAndCancel(page: Page, control: Locator, theme: string) {
  await control.hover()
  await expect(control).toHaveCSS("translate", "-3px -3px")
  await expect(control).toHaveCSS(
    "background-color",
    theme === "light" ? "rgb(38, 98, 16)" : "rgb(144, 184, 0)"
  )
  await expect(control).toHaveCSS(
    "color",
    theme === "light" ? "rgb(255, 255, 255)" : "rgb(6, 59, 0)"
  )
  expect(await contrastRatio(control)).toBeGreaterThanOrEqual(4.5)
  await page.mouse.down()
  await expect(control).toHaveCSS("translate", "0px")
  await page.mouse.move(0, 0)
  await page.mouse.up()
  await expect(control).toHaveCSS("translate", "none")
}

async function expectStatic(card: Locator) {
  await card.hover()
  await expect(card).toHaveCSS("translate", "none")
  await expect(card).toHaveCSS("box-shadow", "none")
}

for (const theme of ["light", "dark"]) {
  for (const width of [390, 1280]) {
    test(`public information stays flat and actions lift at ${width}px in ${theme}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.addInitScript((theme) => {
        localStorage.setItem("indrax-theme", theme)
        localStorage.setItem("indrax-analytics-consent", "denied")
      }, theme)
      await page.goto("/resume")
      const hero = page
        .locator('[data-slot="card"]')
        .filter({ has: page.getByRole("heading", { level: 1 }) })
      await expectStatic(hero)
      for (const control of [
        page.getByRole("link", { name: "LinkedIn profile", exact: true }),
        page.getByRole("link", { name: "GitHub profile", exact: true }),
        page.getByRole("button", { name: "Open about me", exact: true }),
        page.getByRole("button", { name: "Download resume as PDF", exact: true }),
      ])
        await pressAndCancel(page, control, theme)
      const social = page.getByRole("link", { name: "LinkedIn profile", exact: true })
      await social.hover()
      await expect(social).toHaveCSS("translate", "-3px -3px")
      await page.screenshot({
        path: test.info().outputPath(`resume-controls-${theme}-${width}.png`),
      })
      for (const name of ["Tech Stack", "Portfolio"]) {
        const region = page.getByRole("region", { name, exact: true })
        await expectStatic(region.locator("[data-print-columns] > *").first())
      }
      await pressAndCancel(
        page,
        page.getByRole("link", { name: /repository on GitHub/ }).first(),
        theme
      )
      await page.goto("/tech-stack")
      const card = page.getByRole("region", { name: "Interface", exact: true })
      await expectStatic(card)
      const reason = card.getByRole("button", { name: "Why Interface", exact: true })
      await pressAndCancel(page, reason, theme)
      await reason.focus()
      await page.keyboard.press("Enter")
      await expect(reason).toHaveAttribute("aria-expanded", "true")
      await expect(card).toHaveCSS("translate", "none")
      await expect(card).toHaveCSS("box-shadow", "none")
      await reason.hover()
      await expect(reason).toHaveCSS("translate", "-3px -3px")
      await page.screenshot({
        path: test.info().outputPath(`stack-controls-${theme}-${width}.png`),
      })
      const resource = page.getByRole("link", { name: "How GitHub Actions works", exact: true })
      await pressAndCancel(page, resource, theme)
      await resource.hover()
      await expect(resource).toHaveCSS("translate", "-3px -3px")
      await page.screenshot({
        path: test.info().outputPath(`resource-hover-${theme}-${width}.png`),
      })
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width
      )
      const results = await new AxeBuilder({ page }).include("main").analyze()
      expect(
        results.violations.filter(({ impact }) => impact === "serious" || impact === "critical")
      ).toEqual([])
      await page.emulateMedia({ reducedMotion: "reduce" })
      await reason.hover()
      await expect(reason).toHaveCSS("translate", "none")
    })
  }
}
