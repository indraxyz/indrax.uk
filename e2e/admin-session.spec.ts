import AxeBuilder from "@axe-core/playwright"
import { expect, test, type BrowserContext } from "@playwright/test"

import { E2E_BASE_URL } from "./support/constants"
import {
  mintAuthorSession,
  revokeAuthorSession,
  sessionExists,
  SESSION_COOKIE_SECURE,
  type MintOptions,
} from "./support/session"

/**
 * What a session is, and when it stops being one.
 *
 * `admin-boundary.spec.ts` proves that no session is refused. This proves the
 * harder half: that the *wrong* session is refused too. Both halves are needed,
 * because a guard that only rejects the absent case is a guard that lets every
 * stale or unauthorised session through.
 *
 * Covers the criteria under PRD US-4.1 and US-4.2 that could not be reached until
 * `support/session.ts` could mint a session to be wrong with.
 */
test.describe("sessions", () => {
  test.skip(
    !process.env.DATABASE_URL || !process.env.BETTER_AUTH_SECRET,
    "needs a database and BETTER_AUTH_SECRET - see README"
  )

  const minted: string[] = []

  async function contextWith(
    browser: import("@playwright/test").Browser,
    options: MintOptions = {}
  ): Promise<{ context: BrowserContext; token: string }> {
    const session = await mintAuthorSession(options)
    minted.push(session.userId)

    const context = await browser.newContext()
    await context.addCookies([
      {
        name: SESSION_COOKIE_SECURE,
        value: session.cookieValue,
        domain: new URL(E2E_BASE_URL).hostname,
        path: "/",
        secure: true,
        httpOnly: true,
        sameSite: "Strict",
      },
    ])

    return { context, token: session.token }
  }

  test.afterAll(async () => {
    for (const userId of minted) await revokeAuthorSession(userId)
  })

  test("lets the allow-listed author in", async ({ browser }) => {
    // The control. Without it, every assertion below could pass because the admin
    // is broken rather than because the guard works.
    const { context } = await contextWith(browser)
    const page = await context.newPage()
    const editorChunks: string[] = []
    page.on("request", (request) => {
      if (/\/admin\/assets\/editor-[^/]+\.js$/.test(new URL(request.url()).pathname)) {
        editorChunks.push(request.url())
      }
    })

    await page.goto("/admin")
    await expect(page).toHaveURL(/\/admin$/)
    await expect(page.getByRole("link", { name: /new/i }).first()).toBeVisible()
    expect(editorChunks).toEqual([])
    await page.getByRole("link", { name: /new/i }).first().click()
    await expect(page.locator(".tiptap")).toBeVisible()
    expect(editorChunks).toHaveLength(1)

    await context.close()
  })

  test("uses a Lax state cookie for the GitHub OAuth callback", async ({ request }) => {
    test.skip(
      !process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET,
      "needs GitHub OAuth configuration - see README"
    )

    const response = await request.post(`${E2E_BASE_URL}/api/auth/sign-in/social`, {
      headers: { origin: E2E_BASE_URL },
      data: { provider: "github", callbackURL: "/admin" },
    })

    expect(response.ok()).toBe(true)

    const stateCookie = (await response.headersArray()).find(
      ({ name, value }) =>
        name.toLowerCase() === "set-cookie" && /(?:__Secure-)?better-auth\.state=/i.test(value)
    )

    expect(stateCookie?.value).toMatch(/;\s*SameSite=Lax(?:;|$)/i)
    expect(stateCookie?.value).toMatch(/;\s*HttpOnly(?:;|$)/i)
  })

  test("mobile menu matches desktop navigation and keeps preferences and sign-out accessible", async ({
    browser,
  }) => {
    test.setTimeout(60_000)
    const { context } = await contextWith(browser)
    const page = await context.newPage()
    const posts = page.waitForResponse(
      (response) => new URL(response.url()).pathname === "/api/admin/posts/archive"
    )
    await page.goto("/admin/posts")
    expect((await posts).status()).toBe(200)
    await expect(page.getByRole("heading", { name: "Posts", exact: true })).toBeVisible()
    await expect(page.getByRole("main").getByRole("link", { name: /View Writing/i })).toHaveCount(0)
    const desktopLinks = await page
      .getByRole("navigation", { name: "Admin", exact: true })
      .getByRole("link")
      .evaluateAll((links) => links.map((link) => link.getAttribute("href")))
    expect(desktopLinks).toEqual(["/admin", "/admin/posts", "/resume", "/writing"])

    for (const width of [320, 767]) {
      await page.setViewportSize({ width, height: 700 })
      await expect(page.getByRole("navigation", { name: "Admin", exact: true })).toBeHidden()
      const trigger = page.getByRole("button", { name: "Open admin menu" })
      await trigger.click()
      const drawer = page.getByRole("dialog", { name: "Admin menu", exact: true })
      await expect(drawer).toBeVisible()
      const menu = drawer.getByRole("navigation", { name: "Admin", exact: true })
      expect(
        await menu
          .getByRole("link")
          .evaluateAll((links) => links.map((link) => link.getAttribute("href")))
      ).toEqual(desktopLinks)
      await expect(menu.locator('[aria-current="page"]')).toHaveText("Posts")
      await expect(drawer.getByRole("button", { name: /Switch theme/ })).toBeVisible()
      await expect(drawer.getByRole("button", { name: "Sign out", exact: true })).toBeVisible()
      const menuBox = await menu.boundingBox()
      const footerBox = await drawer.locator('[data-slot="drawer-footer"]').boundingBox()
      expect(footerBox!.y).toBeGreaterThan(menuBox!.y + menuBox!.height)
      expect(footerBox!.y + footerBox!.height).toBeLessThanOrEqual(700)
      const accessibility = await new AxeBuilder({ page })
        .include('[data-slot="drawer-content"]')
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
      expect(accessibility.violations).toEqual([])
      await test.info().attach(`Admin menu at ${width}px`, {
        body: await page.screenshot(),
        contentType: "image/png",
      })
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width
      )
      await page.keyboard.press("Escape")
      await expect(drawer).toBeHidden()
      await expect(trigger).toBeFocused()
    }

    await page.getByRole("button", { name: "Open admin menu" }).click()
    await page
      .getByRole("dialog", { name: "Admin menu", exact: true })
      .getByRole("link", { name: "Writing", exact: true })
      .click()
    await expect(page).toHaveURL(/\/writing$/)
    await expect(page.getByRole("dialog", { name: "Admin menu", exact: true })).toBeHidden()
    await page.goto("/admin/posts")
    await page.getByRole("button", { name: "Open admin menu" }).click()
    const drawer = page.getByRole("dialog", { name: "Admin menu", exact: true })
    const theme = drawer.getByRole("button", { name: /Switch theme/ })
    const previousTheme = await theme.getAttribute("aria-label")
    await theme.click()
    await expect(theme).not.toHaveAttribute("aria-label", previousTheme!)
    await expect(drawer).toBeVisible()
    await drawer.getByRole("button", { name: "Sign out", exact: true }).click()
    const confirmation = page.getByRole("alertdialog")
    await expect(confirmation.getByRole("heading", { name: "Sign out?" })).toBeVisible()
    await confirmation.getByRole("button", { name: "Cancel" }).click()
    await expect(confirmation).toBeHidden()
    await expect(drawer).toBeVisible()
    await expect(drawer.getByRole("button", { name: "Sign out", exact: true })).toBeFocused()

    await drawer.getByRole("link", { name: "Admin home", exact: true }).click()
    await expect(page).toHaveURL(/\/admin$/)
    await expect(drawer).toBeHidden()
    await expect(page.getByRole("navigation", { name: "Breadcrumb", exact: true })).toHaveCount(0)
    await page.getByRole("button", { name: "Open admin menu" }).click()
    await expect(drawer.getByRole("link", { name: "Admin home", exact: true })).toHaveAttribute(
      "aria-current",
      "page"
    )
    await drawer.getByRole("button", { name: "Close admin menu" }).click()
    await expect(drawer).toBeHidden()

    await page.getByRole("button", { name: "Open admin menu" }).click()
    await page.setViewportSize({ width: 1024, height: 900 })
    await expect(drawer).toBeHidden()
    await expect(page.getByRole("button", { name: "Open admin menu" })).toBeHidden()
    await expect(page.getByRole("navigation", { name: "Admin", exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: /Switch theme/ })).not.toHaveAttribute(
      "aria-label",
      previousTheme!
    )
    await page.setViewportSize({ width: 375, height: 700 })
    await page.getByRole("button", { name: "Open admin menu" }).click()
    await drawer.getByRole("button", { name: "Sign out", exact: true }).click()
    await confirmation.getByRole("button", { name: "Sign out", exact: true }).click()
    await expect(page).toHaveURL(/\/admin\/login/)
    await expect(drawer).toBeHidden()
    await context.close()
  })

  test("refuses a session belonging to a different GitHub account", async ({ browser }) => {
    // A real, signed, unexpired session - for someone who is not on the list.
    // Nothing about the cookie is wrong, which is exactly why the check has to
    // happen on every request rather than only at sign-up (threat T-1).
    const { context } = await contextWith(browser, { githubId: "999999999" })
    const page = await context.newPage()

    await page.goto("/admin")
    await expect(page).toHaveURL(/\/admin\/login/)
    expect(await page.content()).not.toContain("ProseMirror")

    await context.close()
  })

  test("refuses a session past its absolute age", async ({ browser }) => {
    // Better Auth slides `expiresAt` forward whenever a session is used, so a
    // session kept warm would never expire on idle alone. The absolute cap is
    // measured from `createdAt`, which a refresh does not move.
    const thirtyOneDays = 31 * 24 * 60 * 60 * 1000
    const { context } = await contextWith(browser, { createdAtMsAgo: thirtyOneDays })
    const page = await context.newPage()

    await page.goto("/admin")
    await expect(page).toHaveURL(/\/admin\/login/)

    await context.close()
  })

  test("accepts a session inside its absolute age", async ({ browser }) => {
    // The other side of the boundary, so the test above is not passing because
    // any backdating breaks a session.
    const twentyNineDays = 29 * 24 * 60 * 60 * 1000
    const { context } = await contextWith(browser, { createdAtMsAgo: twentyNineDays })
    const page = await context.newPage()

    await page.goto("/admin")
    await expect(page).toHaveURL(/\/admin$/)

    await context.close()
  })

  test("destroys the session on sign-out, so the cookie cannot be replayed", async ({
    browser,
  }) => {
    const { context, token } = await contextWith(browser)
    const page = await context.newPage()

    await page.goto("/admin")
    await expect(page).toHaveURL(/\/admin$/)

    // Keep the cookie. Signing out has to invalidate the session at the server,
    // not merely clear it in this browser - otherwise a copy of the cookie taken
    // beforehand still works (PRD US-4.2).
    const cookies = await context.cookies()
    const sessionCookie = cookies.find((cookie) => cookie.name === SESSION_COOKIE_SECURE)!

    await page.getByRole("button", { name: /sign out/i }).click()
    const confirmation = page.getByRole("alertdialog")
    await expect(confirmation.getByRole("heading", { name: "Sign out?" })).toBeVisible()
    await confirmation.getByRole("button", { name: "Cancel" }).click()
    await expect(confirmation).toHaveCount(0)
    expect(await sessionExists(token)).toBe(true)

    await page.getByRole("button", { name: /sign out/i }).click()
    await confirmation.getByRole("button", { name: "Sign out" }).click()
    await page.waitForURL(/\/admin\/login/)

    expect(await sessionExists(token)).toBe(false)

    const replay = await browser.newContext()
    await replay.addCookies([sessionCookie])
    const replayed = await replay.newPage()
    await replayed.goto("/admin")
    await expect(replayed).toHaveURL(/\/admin\/login/)

    await replay.close()
    await context.close()
  })

  test("rejects cross-origin writing mutations even with a valid author session", async ({
    browser,
  }) => {
    const { context } = await contextWith(browser)
    // APIRequestContext does not automatically replay Secure cookies to HTTP
    // loopback. Carry the signed cookie explicitly to exercise CSRF after auth.
    const cookie = (await context.cookies()).map(({ name, value }) => `${name}=${value}`).join("; ")
    const session = await context.request.get("/api/admin/session", { headers: { cookie } })
    expect((await session.json()).author).toBeTruthy()
    const response = await context.request.post("/api/admin/posts", {
      headers: { origin: "https://attacker.example", cookie },
      data: { title: "Cross-origin injection", status: "published", tags: [] },
    })
    expect(response.status()).toBe(403)
    expect(await response.text()).not.toContain("requireAuthor")
    await context.close()
  })

  test("enforces upload limits server-side, for a signed-in caller", async ({ browser }) => {
    const { context } = await contextWith(browser)

    // A valid session gets past the guard, which is what makes these assertions
    // about the *validation* rather than about authentication. The client-side
    // checks in the upload component are a courtesy; these are the control
    // (threat T-5, PRD US-3.6).
    const refusals = [
      { label: "a script pretending to be an image", contentType: "text/html", size: 1024 },
      { label: "an SVG, which can carry script", contentType: "image/svg+xml", size: 1024 },
      { label: "a file over the size cap", contentType: "image/png", size: 50 * 1024 * 1024 },
      { label: "a negative size", contentType: "image/png", size: -1 },
      { label: "no file name", contentType: "image/png", size: 1024, fileName: "" },
    ]

    for (const { label, contentType, size, fileName } of refusals) {
      const response = await context.request.post("/api/upload", {
        data: { contentType, size, fileName: fileName ?? "payload" },
      })

      expect(response.ok(), `${label} was accepted`).toBe(false)
      // Above all: no signed URL was handed back.
      expect(await response.text()).not.toContain("r2.cloudflarestorage.com")
    }

    await context.close()
  })
})
