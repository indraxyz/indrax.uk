import { expect, test } from "@playwright/test"

const EXPECTED_FILE_NAME = "Indra-Cahya-Edytya-Resume.pdf"

// The document is drawn in the browser, on demand: the renderer is code-split out
// of the initial bundle and only fetched once someone asks for the file. There is
// no URL to request, so everything here goes through the control itself.
test.describe("the CV download", () => {
  test("hands over a real PDF when the footer control is used", async ({ page }) => {
    await page.goto("/")

    const download = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download resume as PDF" }).click(),
    ]).then(([event]) => event)

    expect(download.suggestedFilename()).toBe(EXPECTED_FILE_NAME)

    const stream = await download.createReadStream()
    const chunks: Buffer[] = []
    for await (const chunk of stream) chunks.push(chunk as Buffer)
    const body = Buffer.concat(chunks)

    expect(body.subarray(0, 5).toString("ascii")).toBe("%PDF-")
    // A PDF this size is the real document; an empty or truncated file is not.
    expect(body.byteLength).toBeGreaterThan(50_000)

    // Embedded rather than linked. Left as fetch-time references these fail
    // silently and the CV loses its typeface and photo.
    const text = body.toString("latin1")
    expect(text).toContain("JetBrainsMono-Regular")
    expect(text).toContain("JetBrainsMono-ExtraBold")
    expect(text).toContain("DCTDecode")
  })

  test("does not ship the renderer until it is asked for", async ({ page }) => {
    const scripts = new Set<string>()
    page.on("response", (response) => {
      if (response.url().endsWith(".js")) scripts.add(response.url())
    })

    await page.goto("/", { waitUntil: "networkidle" })
    const beforeClick = scripts.size

    // Idle and usable with the renderer still unfetched: that is the point of the
    // dynamic import, and a static import would quietly undo it.
    const control = page.getByRole("button", { name: "Download resume as PDF" })
    await expect(control).toBeEnabled()

    await Promise.all([page.waitForEvent("download"), control.click()])

    expect(scripts.size).toBeGreaterThan(beforeClick)
  })
})
