import { expect, test } from "@playwright/test"
import { whenHydrated } from "./support/hydration"
import { SEEDED_POST_SLUG } from "./support/constants"

test("article dates hydrate consistently in a different browser timezone", async ({ browser }) => {
  test.skip(!process.env.DATABASE_URL, "needs the seeded local writing article")
  const context = await browser.newContext({
    baseURL: test.info().project.use.baseURL,
    timezoneId: "Pacific/Honolulu",
  })
  try {
    const page = await context.newPage()
    const errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    page.on("console", (message) => {
      if (message.type() === "error" && /hydrat|server rendered HTML/i.test(message.text()))
        errors.push(message.text())
    })
    await page.goto(`/writing/${SEEDED_POST_SLUG}`)
    await whenHydrated(page)
    const date = page.locator("article time").first()
    const timestamp = await date.getAttribute("datetime")
    expect(timestamp).not.toBeNull()
    await expect(date).toHaveText(
      new Date(timestamp!).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      })
    )
    expect(errors).toEqual([])
  } finally {
    await context.close()
  }
})

test("public documents hydrate without mismatched attributes", async ({ page }) => {
  const errors: string[] = []
  page.on("console", (message) => {
    if (
      ["warning", "error"].includes(message.type()) &&
      /hydrat|server rendered HTML/i.test(message.text())
    )
      errors.push(message.text())
  })
  page.on("pageerror", (error) => errors.push(error.message))

  for (const path of ["/", "/resume", "/writing"]) {
    await page.goto(path)
    await whenHydrated(page)
    // Nonces are hidden in HTML attributes, so compare their DOM properties.
    const nonces = await page
      .locator("script[nonce]")
      .evaluateAll((scripts) => scripts.map((script) => (script as HTMLScriptElement).nonce))
    expect(nonces.length).toBeGreaterThan(0)
    expect(
      nonces.every((nonce) => typeof nonce === "string" && nonce === nonces[0] && nonce.length > 0)
    ).toBe(true)
  }
  expect(errors).toEqual([])
})

test("Writing filters hydrate cleanly after reloading an enabled trigger", async ({ page }) => {
  const errors: string[] = []
  page.on("console", (message) => {
    if (
      ["warning", "error"].includes(message.type()) &&
      /hydrat|server rendered HTML/i.test(message.text())
    )
      errors.push(message.text())
  })
  page.on("pageerror", (error) => errors.push(error.message))

  await page.goto("/writing")
  const trigger = page.getByRole("button", { name: "Filters and sort", exact: true })
  await whenHydrated(page)
  await expect(trigger).toBeEnabled()

  // Firefox can restore a dynamic disabled state before React hydrates a reload.
  for (let reload = 0; reload < 2; reload++) {
    await page.reload()
    await whenHydrated(page)
    await expect(trigger).toBeEnabled()
    await trigger.click()
    const sheet = page.getByRole("dialog", { name: "Filters and sort", exact: true })
    await expect(sheet).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(sheet).toBeHidden()
    await expect(trigger).toBeFocused()
  }
  expect(errors).toEqual([])
})
