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

    await page.goto("/admin")
    await expect(page).toHaveURL(/\/admin$/)
    await expect(page.getByRole("link", { name: /new/i }).first()).toBeVisible()

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
