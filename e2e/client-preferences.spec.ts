import { expect, test } from "@playwright/test"
import { recordAnalytics } from "./support/analytics"
import { whenHydrated } from "./support/hydration"

test.use({
  userAgent:
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
})

test("consent UI follows real second-tab grant, withdrawal, removal and clear", async ({
  page,
  context,
}) => {
  const analytics = await recordAnalytics(page, { consent: null })
  await page.goto("/")
  await whenHydrated(page)
  const other = await context.newPage()
  await other.goto("/")
  await whenHydrated(other)
  const banner = page.getByRole("region", { name: "Analytics consent" })
  await other.getByRole("button", { name: "Accept", exact: true }).click()
  await expect.poll(() => analytics.captured("$pageview"), { timeout: 20_000 }).toBe(true)
  await expect(banner).toBeHidden()
  await expect(page.getByRole("button", { name: "Cookie preferences", exact: true })).toBeVisible()
  await other.evaluate(() => localStorage.setItem("indrax-analytics-consent", "denied"))
  await expect(banner).toBeHidden()
  await expect
    .poll(async () => (await context.cookies()).filter((cookie) => cookie.name.startsWith("ph_")))
    .toEqual([])
  await other.evaluate(() => localStorage.removeItem("indrax-analytics-consent"))
  await expect(banner).toBeVisible()
  await page.getByRole("button", { name: "Decline", exact: true }).click()
  await expect(banner).toBeHidden()
  await other.evaluate(() => localStorage.clear())
  await expect(banner).toBeVisible()
})

for (const path of ["/", "/admin/login"]) {
  test(`theme works with a denied storage getter at ${path}`, async ({ page }) => {
    const errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    await page.addInitScript(() => {
      Object.defineProperty(window, "localStorage", {
        get() {
          throw new Error("blocked storage")
        },
      })
    })
    await page.goto(path)
    if (path === "/") await whenHydrated(page)
    const theme = page.getByRole("button", { name: /Switch theme: light/ })
    await expect(theme).toBeVisible()
    await theme.focus()
    await page.keyboard.press("Enter")
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark")
    await expect(page.getByRole("button", { name: /Switch theme: dark/ })).toBeFocused()
    await page.keyboard.press("Space")
    await expect(page.locator("html")).toHaveAttribute("data-theme", "system")
    await page.emulateMedia({ colorScheme: "dark" })
    await expect(page.locator("html")).toHaveClass(/dark/)
    await page.emulateMedia({ colorScheme: "light" })
    await expect(page.locator("html")).not.toHaveClass(/dark/)
    expect(errors).toEqual([])
  })
}

test("theme persists across reload and public/admin navigation", async ({ page }) => {
  await page.goto("/")
  await whenHydrated(page)
  await page.getByRole("button", { name: /Switch theme: light/ }).click()
  await page.reload()
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark")
  await page.goto("/admin/login")
  await expect(page.getByRole("button", { name: /Switch theme: dark/ })).toBeVisible()
})
