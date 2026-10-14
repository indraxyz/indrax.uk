import { expect, test } from "@playwright/test"

import { E2E_BASE_URL } from "./support/constants"

test.describe("sign-in failures", () => {
  test.skip(
    !process.env.DATABASE_URL ||
      !process.env.BETTER_AUTH_SECRET ||
      !process.env.GITHUB_CLIENT_ID ||
      !process.env.GITHUB_CLIENT_SECRET,
    "needs auth configuration"
  )

  test("explains a refused account and offers retry and public navigation", async ({ page }) => {
    await page.goto("/admin/login?error=account_not_permitted")
    await expect(page.getByRole("heading", { name: "Account not authorised" })).toBeVisible()
    await expect(page.getByText("Switch to the authorised account", { exact: false })).toBeVisible()
    await expect(page.getByRole("button", { name: "Try GitHub again" })).toBeVisible()
    await page.getByRole("link", { name: "Back to site" }).click()
    await expect(page).toHaveURL(`${E2E_BASE_URL}/`)
  })

  test("explains an expired OAuth attempt", async ({ page }) => {
    await page.goto("/admin/login?error=state_mismatch")
    await expect(page.getByText("Your sign-in attempt expired", { exact: false })).toBeVisible()
    await expect(page.getByRole("button", { name: "Try GitHub again" })).toBeVisible()
  })

  test("loads the auth client only when sign-in is requested and handles a rejected start", async ({
    page,
  }) => {
    const authChunks: string[] = []
    page.on("request", (request) => {
      if (/\/admin\/assets\/auth-client-[^/]+\.js$/.test(new URL(request.url()).pathname)) {
        authChunks.push(request.url())
      }
    })
    await page.route("**/api/auth/sign-in/social", async (route) => {
      expect(route.request().method()).toBe("POST")
      expect(route.request().postDataJSON().provider).toBe("github")
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ code: "FIXTURE_REJECTED", message: "Fixture rejected sign-in." }),
      })
    })
    await page.goto("/admin/login")
    const signIn = page.getByRole("button", { name: "Continue with GitHub", exact: true })
    await expect(signIn).toBeVisible()
    expect(authChunks).toEqual([])
    await signIn.click()
    await expect(page.getByRole("alert")).toHaveText("Sign-in could not start. Please try again.")
    expect(authChunks).toHaveLength(1)
    await expect(signIn).toBeEnabled()
    await expect(page).toHaveURL(`${E2E_BASE_URL}/admin/login`)
  })

  test("mobile sign-in menu offers theme controls without protected navigation", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 700 })
    await page.goto("/admin/login")
    await page.getByRole("button", { name: "Open admin menu" }).click()
    const drawer = page.getByRole("dialog", { name: "Admin menu", exact: true })
    await expect(drawer).toBeVisible()
    await expect(drawer.getByRole("button", { name: /Switch theme/ })).toBeVisible()
    await expect(drawer.getByRole("navigation", { name: "Admin", exact: true })).toHaveCount(0)
    await expect(drawer.getByRole("button", { name: "Sign out", exact: true })).toHaveCount(0)
    await page.mouse.click(10, 300)
    await expect(drawer).toBeHidden()
    await expect(page.getByRole("button", { name: "Open admin menu" })).toBeFocused()
  })

  test("does not reflect arbitrary provider errors or descriptions", async ({ page }) => {
    await page.goto(
      "/admin/login?error=untrusted-provider-value&error_description=private-provider-detail"
    )
    await expect(
      page.getByText("We could not complete GitHub sign-in. Please try again.")
    ).toBeVisible()
    const content = await page.locator("main").innerText()
    expect(content).not.toContain("untrusted-provider-value")
    expect(content).not.toContain("private-provider-detail")
  })

  test("redirects a callback without state to the site's failure screen", async ({ request }) => {
    const response = await request.get("/api/auth/callback/github?error=access_denied", {
      maxRedirects: 0,
    })
    expect(response.status()).toBe(302)
    expect(response.headers().location).toBe("/admin/login?error=state_not_found")
    expect(response.headers()["set-cookie"] ?? "").not.toContain("session_token=")
  })

  test("handles a cancelled OAuth attempt through the stored callback URL", async ({
    request,
    page,
  }) => {
    const start = await request.post("/api/auth/sign-in/social", {
      headers: { origin: E2E_BASE_URL },
      data: { provider: "github", callbackURL: "/admin", errorCallbackURL: "/admin/login" },
    })
    expect(start.ok()).toBe(true)
    const { url } = await start.json()
    const state = new URL(url).searchParams.get("state")
    expect(state).toBeTruthy()
    // Production auth sets Secure cookies. This HTTP loopback API client does
    // not replay them automatically, so carry the returned state cookie as an
    // HTTPS browser would on GitHub's callback.
    const cookie = (await start.headersArray())
      .filter(({ name }) => name.toLowerCase() === "set-cookie")
      .map(({ value }) => value.split(";")[0])
      .join("; ")
    const callback = await request.get(
      `/api/auth/callback/github?state=${state}&error=access_denied`,
      { maxRedirects: 0, headers: { cookie } }
    )
    expect(callback.status()).toBe(302)
    expect(callback.headers().location).toBe("/admin/login?error=access_denied")
    await page.goto(callback.headers().location)
    await expect(page.getByText("GitHub sign-in was cancelled.", { exact: false })).toBeVisible()
  })
})
