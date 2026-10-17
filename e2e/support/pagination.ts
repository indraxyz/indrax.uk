import { expect, test, type Page } from "@playwright/test"

/** Verify the shared archive controls using their rendered styles and real navigation. */
export async function expectIconPagination(page: Page, label: string, width: number) {
  const pagination = page.getByRole("navigation", { name: label, exact: true })
  await expect(pagination).toContainText("Page 2 of 3")
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
  const bounds = await pagination.boundingBox()
  const info = await pagination.getByText("Page 2 of 3", { exact: true }).boundingBox()
  const previous = await pagination
    .getByRole("link", { name: "Previous", exact: true })
    .boundingBox()
  const next = await pagination.getByRole("link", { name: "Next", exact: true }).boundingBox()
  expect(Math.abs(info!.x - bounds!.x)).toBeLessThanOrEqual(1)
  expect(previous!.x).toBeGreaterThan(info!.x + info!.width)
  expect(Math.abs(next!.x - (previous!.x + previous!.width) - 8)).toBeLessThanOrEqual(1)
  expect(Math.abs(next!.x + next!.width - (bounds!.x + bounds!.width))).toBeLessThanOrEqual(1)
  await pagination.screenshot({ path: test.info().outputPath(`pagination-${width}.png`) })
  await pagination.getByRole("link", { name: "Next", exact: true }).click()
  await expect(pagination).toContainText("Page 3 of 3")
  await expect(pagination.getByRole("link", { name: "Next", exact: true })).toHaveCount(0)
  await pagination.getByRole("link", { name: "Previous", exact: true }).click()
  await expect(pagination).toContainText("Page 2 of 3")
  await pagination.getByRole("link", { name: "Previous", exact: true }).click()
  await expect(pagination).toContainText("Page 1 of 3")
  await expect(pagination.getByRole("link", { name: "Previous", exact: true })).toHaveCount(0)
}
