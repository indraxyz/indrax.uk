import { expect, test } from "@playwright/test"

// Shapes only what the specs read back; the block itself is built from the resume
// data in `features/resume/utils/structured-data.ts`.
type ProfilePage = {
  "@context": string
  "@type": string
  mainEntity: {
    "@type": string
    name: string
    jobTitle: string
    url: string
    sameAs: string[]
    knowsAbout: string[]
    telephone?: string
    birthDate?: string
  }
}

async function readStructuredData(page: import("@playwright/test").Page) {
  const blocks = page.locator('script[type="application/ld+json"]')
  await expect(blocks).toHaveCount(1)

  const raw = await blocks.first().textContent()
  expect(raw, "the JSON-LD block should not be empty").toBeTruthy()

  return JSON.parse(raw as string) as ProfilePage
}

test.describe("structured data", () => {
  test("describes the page as a person's profile", async ({ page }) => {
    await page.goto("/")
    const data = await readStructuredData(page)

    expect(data["@context"]).toBe("https://schema.org")
    expect(data["@type"]).toBe("ProfilePage")
    expect(data.mainEntity["@type"]).toBe("Person")
  })

  test("carries the name and role from the resume data", async ({ page }) => {
    await page.goto("/")
    const data = await readStructuredData(page)

    expect(data.mainEntity.name).toBe("Indra Cahya Edytya")
    expect(data.mainEntity.jobTitle).toBe("Agentic Software Engineer")
    expect(data.mainEntity.url).toMatch(/^https?:\/\//)
    expect(data.mainEntity.knowsAbout.length).toBeGreaterThan(0)
  })

  test("claims the GitHub and LinkedIn profiles as the same person", async ({ page }) => {
    await page.goto("/")
    const data = await readStructuredData(page)

    expect(data.mainEntity.sameAs).toEqual(
      expect.arrayContaining([
        expect.stringContaining("github.com/indraxyz"),
        expect.stringContaining("linkedin.com/in/indra-cahya-edytya"),
      ])
    )
  })

  test("withholds the phone number and date of birth", async ({ page }) => {
    await page.goto("/")
    const data = await readStructuredData(page)

    // Deliberate: a phone number in structured data is a standing invitation to
    // scrapers, and neither field is needed to resolve the identity.
    expect(data.mainEntity.telephone).toBeUndefined()
    expect(data.mainEntity.birthDate).toBeUndefined()
    expect(JSON.stringify(data)).not.toContain("0813")
  })
})
