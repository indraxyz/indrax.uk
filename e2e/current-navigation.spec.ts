import { expect, test, type Locator } from "@playwright/test"

async function expectCurrentPage(link: Locator) {
  await expect(link).toHaveAttribute("aria-current", "page")
  expect(
    await link.evaluate((element) => {
      const style = getComputedStyle(element)
      return (
        style.borderBottomColor !== "rgba(0, 0, 0, 0)" &&
        style.backgroundColor !== "rgba(0, 0, 0, 0)"
      )
    })
  ).toBe(true)
}

for (const theme of ["light", "dark"]) {
  test(`public navigation and breadcrumbs follow the current page in ${theme}`, async ({
    page,
  }) => {
    await page.addInitScript((value) => localStorage.setItem("indrax-theme", value), theme)
    await page.emulateMedia({ colorScheme: theme as "light" | "dark" })
    await page.goto("/resume")
    const navigation = page.getByRole("navigation", { name: "Site", exact: true })
    await expectCurrentPage(navigation.getByRole("link", { name: "Resume", exact: true }))
    await expectCurrentPage(
      page.getByRole("navigation", { name: "Breadcrumb" }).locator('[aria-current="page"]')
    )
    await navigation.getByRole("link", { name: "Stack", exact: true }).click()
    await expect(page).toHaveURL(/\/tech-stack$/)
    await expectCurrentPage(navigation.getByRole("link", { name: "Stack", exact: true }))
    await expect(navigation.getByRole("link", { name: "Resume", exact: true })).not.toHaveAttribute(
      "aria-current"
    )
    await expect(
      page.getByRole("navigation", { name: "Breadcrumb" }).locator('[aria-current="page"]')
    ).toHaveText("Stack")
  })
}

for (const width of [375, 1280]) {
  test(`admin keeps Posts active while creating a post and opens public links in new tabs at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.context().addCookies([
      {
        name: "better-auth.session_token",
        value: "browser-fixture",
        url: test.info().project.use.baseURL as string,
      },
    ])
    await page.route("**/api/admin/session", (route) =>
      route.fulfill({
        json: {
          author: { id: "fixture-author", name: "Indra", email: "author@example.test" },
          authConfigured: true,
          databaseConfigured: true,
          coverUploadsConfigured: false,
          previewConfigured: true,
        },
      })
    )
    await page.route("**/api/admin/tags", (route) => route.fulfill({ json: [] }))
    await page.goto("/admin/posts/new")
    await expect(page.getByRole("heading", { name: "New post", exact: true })).toBeVisible()
    await expect(
      page.getByRole("navigation", { name: "Breadcrumb" }).locator('[aria-current="page"]')
    ).toHaveText("New post")
    if (width < 768) await page.getByRole("button", { name: "Open admin menu" }).click()
    const navigation = page
      .getByRole("navigation", { name: "Admin", exact: true })
      .filter({ visible: true })
    await expectCurrentPage(navigation.getByRole("link", { name: "Posts", exact: true }))
    await navigation.getByRole("button", { name: "Public" }).click()
    for (const name of ["Resume", "Writing", "Stack"]) {
      const item = page.getByRole("menuitem", { name, exact: true })
      await expect(item).toHaveAttribute("target", "_blank")
      await expect(item).toHaveAttribute("rel", "noopener noreferrer")
    }
  })
}

test("home process diagram uses concise build and review labels", async ({ page }) => {
  await page.goto("/")
  const process = page.getByRole("region", { name: "From Ideation to Production" })
  await expect(process.getByText("Build", { exact: true })).toBeVisible()
  await expect(process.getByText("Review", { exact: true })).toBeVisible()
  await expect(process.getByText(/^(Build|Review) agent$/i)).toHaveCount(0)
})

for (const width of [320, 1280]) {
  for (const theme of ["light", "dark"]) {
    test(`admin Dashboard icon owns the active home state at ${width}px in ${theme}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.addInitScript((value) => localStorage.setItem("indrax-theme", value), theme)
      await page.context().addCookies([
        {
          name: "better-auth.session_token",
          value: "browser-fixture",
          url: test.info().project.use.baseURL as string,
        },
      ])
      await page.route("**/api/admin/session", (route) =>
        route.fulfill({
          json: {
            author: { id: "fixture-author", name: "Indra", email: "author@example.test" },
            authConfigured: true,
            databaseConfigured: true,
            coverUploadsConfigured: false,
            previewConfigured: true,
          },
        })
      )
      await page.route("**/api/admin/tags", (route) => route.fulfill({ json: [] }))
      await page.route("**/api/admin/overview", (route) =>
        route.fulfill({
          json: {
            total: 0,
            published: 0,
            drafts: 0,
            archived: 0,
            latestDraft: null,
          },
        })
      )
      await page.goto("/admin/posts/new")
      await expect(page.getByRole("heading", { name: "New post", exact: true })).toBeVisible()
      const header = page.locator("header")
      const brand = header.getByRole("link", { name: "Indra's Admin", exact: true })
      await brand.hover()
      await expect(brand).toHaveCSS("text-decoration-line", "none")
      await expect(brand).toHaveCSS("border-bottom-width", "0px")
      await expect(brand).not.toHaveAttribute("aria-current")
      if (width < 900) {
        await expect(header.getByRole("link", { name: "Dashboard", exact: true })).toHaveCount(0)
        await header.getByRole("button", { name: "Open admin menu" }).click()
      }
      const dashboard = page
        .getByRole("link", { name: "Dashboard", exact: true })
        .filter({ visible: true })
      await expect(dashboard).toBeVisible()
      await expect(dashboard).not.toHaveAttribute("aria-current")
      await expect(dashboard.locator("svg")).toHaveCount(1)
      await dashboard.click()
      await expect(page).toHaveURL(/\/admin$/)
      await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible()
      await brand.hover()
      await expect(brand).toHaveCSS("text-decoration-line", "none")
      await expect(brand).toHaveCSS("border-bottom-width", "0px")
      await expect(brand).not.toHaveAttribute("aria-current")
      if (width < 900) {
        await expect(
          page.getByRole("dialog", { name: "Admin menu", exact: true })
        ).not.toBeVisible()
        await expect(header.getByRole("link", { name: "Dashboard", exact: true })).toHaveCount(0)
        await header.getByRole("button", { name: "Open admin menu" }).click()
        await expectCurrentPage(dashboard)
        await expect(dashboard).toHaveCSS("height", "48px")
        await page.keyboard.press("Escape")
      } else {
        await expectCurrentPage(dashboard)
        for (const edge of ["top", "left", "right"])
          await expect(dashboard).toHaveCSS(`border-${edge}-width`, "0px")
        await expect(dashboard).toHaveCSS("border-bottom-width", "2px")
        const box = await dashboard.boundingBox()
        expect(box?.width).toBe(44)
        expect(box?.height).toBe(44)
      }
    })
  }
}
