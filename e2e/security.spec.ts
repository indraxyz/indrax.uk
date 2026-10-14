import { expect, test, type Page } from "@playwright/test"

/**
 * The browser half of the hardening in `lib/security-headers.ts`.
 *
 * A strict Content-Security-Policy is only worth having if the site still works
 * under it and an injected script still fails. So each page here is loaded in a
 * real browser, which reports every policy violation; a page that hydrates with
 * none, and a planted `<script>` that does not run, is the pass.
 */
function collectViolations(page: Page) {
  const violations: string[] = []
  page.on("console", (message) => {
    if (/Content Security Policy/i.test(message.text())) violations.push(message.text())
  })
  return violations
}

const scriptSources = (policy: string) =>
  policy
    .split("; ")
    .find((directive) => directive.startsWith("script-src "))
    ?.split(" ")
    .slice(1) ?? []

test.describe("the content security policy", () => {
  test("public pages carry a fresh nonce on every inline script and hydrate cleanly", async ({
    page,
  }) => {
    const violations = collectViolations(page)
    const nonces = new Set<string>()
    for (const path of ["/", "/writing", "/resume"]) {
      await test.step(path, async () => {
        const response = await page.goto(path)
        const policy = response!.headers()["content-security-policy"]
        const sources = scriptSources(policy)
        expect(sources).not.toContain("'unsafe-inline'")
        expect(sources).not.toContain("'unsafe-eval'")
        const nonce = sources.find((source) => source.startsWith("'nonce-"))?.slice(7, -1)
        expect(nonce, `${path} has no nonce`).toBeTruthy()
        nonces.add(nonce!)

        // Every executable inline script is admitted by the nonce or the theme hash.
        const unadmitted = await page.evaluate(
          () =>
            [...document.querySelectorAll("script:not([src])")].filter(
              (script) =>
                !["application/ld+json", "application/json"].includes(
                  script.getAttribute("type") ?? ""
                ) &&
                !(script as HTMLScriptElement).nonce &&
                !script.textContent?.includes("indrax-theme")
            ).length
        )
        expect(unadmitted).toBe(0)
        // Hydrated: React Router's client runtime ran under the policy.
        await expect.poll(() => page.evaluate(() => "__reactRouterContext" in window)).toBe(true)
        // The hashed theme initializer ran too.
        expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBeTruthy()
      })
    }
    expect(nonces.size).toBe(3)
    expect(violations).toEqual([])
  })

  test("an injected inline script does not run", async ({ page }) => {
    await page.goto("/")
    const violations = collectViolations(page)
    const ran = await page.evaluate(async () => {
      const script = document.createElement("script")
      script.textContent = "window.__injected = true"
      document.body.appendChild(script)
      const image = document.createElement("img")
      image.setAttribute("onerror", "window.__injectedHandler = true")
      image.src = "data:image/png;base64,broken"
      document.body.appendChild(image)
      await new Promise((resolve) => setTimeout(resolve, 200))
      const flags = window as unknown as Record<string, unknown>
      return Boolean(flags.__injected || flags.__injectedHandler)
    })
    expect(ran).toBe(false)
    await expect.poll(() => violations.length).toBeGreaterThan(0)
  })

  test("the admin shell boots under the policy", async ({ page }) => {
    const violations = collectViolations(page)
    const response = await page.goto("/admin/login")
    const sources = scriptSources(response!.headers()["content-security-policy"])
    expect(sources).not.toContain("'unsafe-inline'")
    // Either sign-in state renders only if the bundle and theme script both ran.
    await expect(
      page
        .getByRole("button", { name: "Continue with GitHub", exact: true })
        .or(page.getByText("Author access is unavailable."))
    ).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBeTruthy()
    expect(violations).toEqual([])
  })
})

test.describe("what a scanner can learn", () => {
  test("production does not serve simulated local covers", async ({ request }) => {
    const response = await request.get(
      "/local-media/covers/51dad294-2e29-40c4-9c1f-2df003c48e57.png"
    )
    expect(response.status()).toBe(404)
  })
  test("the anonymous admin session reveals only whether sign-in exists", async ({ request }) => {
    const response = await request.get("/api/admin/session")
    expect(response.status()).toBe(200)
    expect(Object.keys(await response.json()).sort()).toEqual(["authConfigured", "author"])
  })

  test("repository and environment files are not served", async ({ request }) => {
    for (const path of ["/.git/config", "/.git/HEAD", "/.env", "/.env.local", "/.dev.vars"]) {
      const response = await request.get(path)
      expect(response.status(), path).toBe(404)
      expect(await response.text(), path).not.toMatch(/\[core\]|DATABASE_URL|SECRET/)
    }
  })

  test("malformed view-counter paths are a 400, not a Worker crash", async ({ request }) => {
    expect((await request.get("/api/views/%E0%A4%A")).status()).toBe(400)
  })
})
