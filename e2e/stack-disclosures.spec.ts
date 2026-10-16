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
    const interfaceReason = interfaceCard.getByText(
      /Server rendering makes profile and article content/
    )

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

test("stack explains the current development and protected release workflow", async ({ page }) => {
  await page.goto("/tech-stack")

  const local = page.getByRole("region", { name: "Local development", exact: true })
  await expect(local).toContainText("React Router / Vite")
  await expect(local).toContainText("independent admin build watcher")
  await expect(local).toContainText("share .env.local")

  const data = page.getByRole("region", { name: "Data", exact: true })
  await expect(data).toContainText("Cloudflare KV caches public content")
  await expect(data).toContainText("D1 tracks cache revisions and analytics quotas")
  await data.getByRole("button", { name: "Why Data", exact: true }).click()
  await expect(data).toContainText("replacing a cover or deleting its post queues cleanup")

  const ci = page.getByRole("region", { name: "CI/CD", exact: true })
  await expect(ci).toContainText("two checks for pull requests")
  await expect(ci).toContainText("seeded local database")
  await expect(ci).toContainText("uploads against isolated R2 storage")
  await expect(ci).toContainText("develop deploys to Preview and main deploys to Production")
  await ci.getByRole("button", { name: "Why CI/CD", exact: true }).click()
  const releasePolicy = ci.locator('[data-slot="collapsible-content"]')
  await expect(releasePolicy).toBeVisible()
  await expect(releasePolicy).toContainText("documented main-branch policy")
  await expect(releasePolicy).toContainText("reviewer approval")
  await expect(releasePolicy).toContainText("successful Preview deployment")
  await expect(releasePolicy).toContainText("resolved review conversations")

  const deployment = page.getByRole("region", { name: "Deployment", exact: true })
  await expect(deployment).toContainText("only explicitly allowed public settings")
  await deployment.getByRole("button", { name: "Why Deployment", exact: true }).click()
  await expect(deployment).toContainText("matching D1 analytics quota tables")
  await expect(deployment).toContainText("security smoke check")

  const monitoring = page.getByRole("region", { name: "Measurement & monitoring", exact: true })
  await expect(monitoring).toContainText("same-origin Worker gateway")
  await expect(monitoring).toContainText("shared monthly quotas in D1")
  await monitoring
    .getByRole("button", { name: "Why Measurement & monitoring", exact: true })
    .click()
  await expect(monitoring).toContainText("automatic fetch traces are disabled")
  await expect(page.locator('[data-slot="stack-cards"]')).not.toContainText("NEXT_")
})
