import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"

for (const width of [320, 1280]) {
  test(`stack reasons expand independently with keyboard at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto("/tech-stack")

    const cards = page.locator('[data-slot="stack-cards"]')
    const interfaceCard = cards.getByRole("region", { name: "Interface", exact: true })
    const interfaceTrigger = interfaceCard.getByRole("button", {
      name: "Why Interface",
      exact: true,
    })
    const interfacePanel = interfaceCard.locator('[data-slot="collapsible-content"]')
    const dataTrigger = cards.getByRole("button", { name: "Why Data", exact: true })
    const interfaceReason = interfaceCard.getByText(/Server rendering keeps content and metadata/)

    await expect(cards.getByRole("button", { name: /^Why / })).toHaveCount(10)
    await expect(interfaceTrigger).toHaveAttribute("aria-expanded", "false")
    await expect(interfaceReason).not.toBeVisible()
    await interfaceTrigger.focus()
    await page.keyboard.press("Enter")
    await expect(interfaceTrigger).toHaveAttribute("aria-expanded", "true")
    await expect(interfaceTrigger).toHaveAttribute(
      "aria-controls",
      (await interfacePanel.getAttribute("id")) ?? ""
    )
    await expect(interfaceReason).toBeVisible()
    await interfacePanel.evaluate(async (element) => {
      await Promise.all(element.getAnimations().map((animation) => animation.finished))
    })
    expect(
      await interfacePanel.evaluate((element) => getComputedStyle(element).transitionProperty)
    ).toContain("height")

    await dataTrigger.click()
    await expect(dataTrigger).toHaveAttribute("aria-expanded", "true")
    await expect(interfaceTrigger).toHaveAttribute("aria-expanded", "true")
    await interfaceTrigger.focus()
    await page.keyboard.press("Space")
    await expect(interfaceTrigger).toHaveAttribute("aria-expanded", "false")
    await expect(interfaceReason).not.toBeVisible()
    await expect(interfaceTrigger).toBeFocused()
    await expect(dataTrigger).toHaveAttribute("aria-expanded", "true")
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width
    )
    await page.screenshot({ path: `test-results/stack-disclosures-${width}.png`, fullPage: true })
  })
}

test("stack disclosures honor reduced motion and remain accessible when expanded", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/tech-stack")
  const interfaceCard = page.getByRole("region", { name: "Interface", exact: true })
  const trigger = interfaceCard.getByRole("button", { name: "Why Interface", exact: true })
  await trigger.click()
  const panel = interfaceCard.locator('[data-slot="collapsible-content"]')
  await expect(panel).toBeVisible()
  expect(await panel.evaluate((element) => getComputedStyle(element).transitionProperty)).toBe(
    "none"
  )
  expect(
    await trigger.locator("svg").evaluate((element) => getComputedStyle(element).transitionProperty)
  ).toBe("none")

  const results = await new AxeBuilder({ page })
    .include('[data-slot="stack-cards"]')
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze()
  expect(
    results.violations.filter(({ impact }) => impact === "serious" || impact === "critical")
  ).toEqual([])
})
