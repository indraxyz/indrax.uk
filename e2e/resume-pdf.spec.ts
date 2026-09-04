import { expect, test } from "@playwright/test"

const EXPECTED_FILE_NAME = "Indra-Cahya-Edytya-Resume.pdf"

test.describe("the CV at a permanent URL", () => {
  test("serves a real PDF", async ({ request }) => {
    const response = await request.get("/resume.pdf")

    expect(response.status()).toBe(200)
    expect(response.headers()["content-type"]).toContain("application/pdf")
    expect(response.headers()["content-disposition"]).toContain(EXPECTED_FILE_NAME)

    const body = await response.body()
    expect(body.subarray(0, 5).toString("ascii")).toBe("%PDF-")
    // A PDF this size is the real document; an empty or error page is not.
    expect(body.byteLength).toBeGreaterThan(50_000)
  })

  test("embeds the fonts and the photo rather than linking them", async ({ request }) => {
    const body = (await (await request.get("/resume.pdf")).body()).toString("latin1")

    // Rendered on the server, these assets resolve from disk. Left as browser paths
    // they fail silently and the CV loses its typeface and photo.
    expect(body).toContain("JetBrainsMono-Regular")
    expect(body).toContain("JetBrainsMono-ExtraBold")
    expect(body).toContain("DCTDecode")
  })

  test("is what the footer control points at", async ({ page }) => {
    await page.goto("/")

    const link = page.getByRole("link", { name: "Download resume as PDF" })
    await expect(link).toHaveAttribute("href", "/resume.pdf")
    await expect(link).toHaveAttribute("download", EXPECTED_FILE_NAME)
  })

  test("downloads when the footer control is used", async ({ page }) => {
    await page.goto("/")

    const download = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("link", { name: "Download resume as PDF" }).click(),
    ]).then(([event]) => event)

    expect(download.suggestedFilename()).toBe(EXPECTED_FILE_NAME)
  })
})
