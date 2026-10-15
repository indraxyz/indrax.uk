import { expect, test } from "@playwright/test"
import { whenHydrated } from "./support/hydration"

test("public documents hydrate without mismatched attributes", async ({ page }) => {
  const errors: string[] = []
  page.on("console", (message) => {
    if (/hydrat|server rendered HTML/i.test(message.text())) errors.push(message.text())
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
