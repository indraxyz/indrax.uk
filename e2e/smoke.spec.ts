import { expect, test } from "@playwright/test"

test.describe("the resume page", () => {
  test("renders and names the person", async ({ page }) => {
    const errors: string[] = []
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text())
    })

    await page.goto("/")

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Indra")
    await expect(page).toHaveTitle(/Indra Cahya Edytya/)
    expect(errors).toEqual([])
  })

  test("exposes the three sections and the contact landmark", async ({ page }) => {
    await page.goto("/")

    await expect(page.getByRole("navigation", { name: "Contact" })).toBeVisible()
    await expect(page.getByRole("main")).toBeVisible()
  })
})
