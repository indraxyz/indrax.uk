import { expect, test, type Page } from "@playwright/test"

/** Verify the shared archive controls using their rendered styles and real navigation. */
export async function expectIconPagination(page: Page, label: string, width: number) {
  const pagination = page.getByRole("navigation", { name: label, exact: true })
  await expect(pagination).toContainText("2 of 3")
  for (const name of ["Previous", "Next"]) {
    const link = pagination.getByRole("link", { name, exact: true })
    await expect(link).toHaveText("")
    await expect(link.locator("svg")).toBeVisible()
    await expect(link).toHaveCSS("border-top-width", "0px")
    await expect(link).toHaveCSS("width", "44px")
    await expect(link).toHaveCSS("height", "44px")
    await link.hover()
    await expect(link).toHaveCSS("border-top-width", "0px")
    await link.focus()
    await expect(link).toBeFocused()
  }
  await pagination.getByRole("link", { name: "Next", exact: true }).blur()
  await page.mouse.move(0, 0)
  await pagination.screenshot({ path: test.info().outputPath(`pagination-${width}.png`) })
  await pagination.getByRole("link", { name: "Next", exact: true }).click()
  await expect(pagination).toContainText("3 of 3")
  await expect(pagination.getByRole("link", { name: "Next", exact: true })).toHaveCount(0)
  await pagination.getByRole("link", { name: "Previous", exact: true }).click()
  await expect(pagination).toContainText("2 of 3")
  await pagination.getByRole("link", { name: "Previous", exact: true }).click()
  await expect(pagination).toContainText("1 of 3")
  await expect(pagination.getByRole("link", { name: "Previous", exact: true })).toHaveCount(0)
}
