import { expect, test } from "@playwright/test"

import { whenHydrated } from "./support/hydration"

test("public links navigate without speculative Worker page requests", async ({ page }) => {
  const prefetched: string[] = []
  page.on("request", (request) => {
    if (request.headers()["next-router-prefetch"] === "1") prefetched.push(request.url())
  })

  await page.goto("/writing")
  await whenHydrated(page)
  const resume = page
    .getByRole("navigation", { name: "Site" })
    .getByRole("link", { name: "Resume" })
  await resume.hover()
  await page.waitForLoadState("networkidle")
  expect(prefetched).toEqual([])

  await resume.click()
  await expect(page).toHaveURL(/\/resume$/)
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
})
