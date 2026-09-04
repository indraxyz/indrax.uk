import { expect, test } from "@playwright/test"

const EMAIL = "indracahyae@gmail.com"

test.describe("contact actions", () => {
  test("offers an email action carrying the address", async ({ page }) => {
    await page.goto("/")

    const contact = page.getByRole("navigation", { name: "Contact" })
    const email = contact.getByRole("link", { name: `Email ${EMAIL}` })

    await expect(email).toBeVisible()
    await expect(email).toHaveAttribute("href", `mailto:${EMAIL}`)
    // Rendered as text, not only as a link target: a printed sheet has no link to
    // follow, and before this neither the page nor the print copy carried an email.
    await expect(email).toContainText(EMAIL)
  })

  test("links out to LinkedIn and GitHub safely", async ({ page }) => {
    await page.goto("/")
    const contact = page.getByRole("navigation", { name: "Contact" })

    for (const [name, host] of [
      ["LinkedIn profile", "linkedin.com"],
      ["GitHub profile", "github.com"],
    ]) {
      const link = contact.getByRole("link", { name })
      await expect(link).toHaveAttribute("href", new RegExp(host.replace(".", "\\.")))
      await expect(link).toHaveAttribute("target", "_blank")
      await expect(link).toHaveAttribute("rel", /noopener/)
      await expect(link).toHaveAttribute("rel", /noreferrer/)
    }
  })

  test("is reachable by keyboard", async ({ page }) => {
    await page.goto("/")

    const email = page
      .getByRole("navigation", { name: "Contact" })
      .getByRole("link", { name: `Email ${EMAIL}` })

    await email.focus()
    await expect(email).toBeFocused()
  })

  test("does not duplicate the header's GitHub control by name", async ({ page }) => {
    await page.goto("/")

    // Two links sharing an accessible name is ambiguous for anyone navigating by
    // link list, which is why the contact actions sit in their own landmark.
    const contactGithub = page
      .getByRole("navigation", { name: "Contact" })
      .getByRole("link", { name: "GitHub profile" })

    await expect(contactGithub).toHaveCount(1)
  })
})
