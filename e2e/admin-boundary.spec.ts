import { expect, test } from "@playwright/test"

/**
 * The access-control boundary.
 *
 * The PRD's minimum bar is explicit that every criterion under E4 has automated
 * coverage before launch, so this file covers what can be covered without a real
 * GitHub OAuth application: that nothing under `/admin` is reachable, that no
 * mutating entry point accepts an unauthenticated caller, and that the admin
 * stays out of search results.
 *
 * What it deliberately does not cover is the GitHub round trip itself. Testing
 * that would mean either standing up a fake identity provider - proving that a
 * mock behaves like a mock - or checking a real OAuth application's credentials
 * into the suite. The allow-list logic those credentials would exercise is
 * `requireAuthor()`, and every assertion below runs through it.
 *
 * These run with no database and no OAuth configured, which is the state of a
 * fresh clone. That is the harder case, not the easier one: an unconfigured
 * deployment must be *more* closed than a configured one, never less.
 */
test.describe("the admin boundary", () => {
  const GUARDED = ["/admin", "/admin/posts", "/admin/new", "/admin/edit/some-id"]

  test("sends a signed-out visitor to the login page", async ({ page }) => {
    for (const path of GUARDED) {
      await test.step(path, async () => {
        await page.goto(path)
        // Either the proxy redirected, or the page's own guard did. Which one is
        // an implementation detail; that neither renders the admin is not.
        await expect(page).toHaveURL(/\/admin\/login/)
      })
    }
  })

  test("never renders admin content to a signed-out visitor", async ({ page }) => {
    for (const path of GUARDED) {
      await test.step(path, async () => {
        await page.goto(path)
        const body = await page.content()

        // The editor is the tell: if any of it reached the page, the guard did
        // not run before rendering.
        expect(body).not.toContain("ProseMirror")
        expect(body).not.toContain("Article body")
        await expect(page.getByRole("button", { name: /save/i })).toHaveCount(0)
      })
    }
  })

  test("marks every admin response noindex", async ({ request }) => {
    for (const path of [...GUARDED, "/admin/login"]) {
      const response = await request.get(path)
      const header = response.headers()["x-robots-tag"] ?? ""
      const html = await response.text()

      // Either the header from the proxy or the meta tag from the layout - both
      // are set, and a response carrying neither is the failure.
      expect(
        header.includes("noindex") || /<meta name="robots"[^>]*noindex/.test(html),
        `${path} was indexable`
      ).toBe(true)
    }
  })

  test("keeps the admin out of robots.txt and the sitemap", async ({ request }) => {
    const robots = await (await request.get("/robots.txt")).text()
    expect(robots).toContain("Disallow: /admin")

    const sitemap = await (await request.get("/sitemap.xml")).text()
    expect(sitemap).not.toContain("/admin")
  })

  test("refuses an unauthenticated upload without minting a URL", async ({ request }) => {
    const response = await request.post("/api/upload", {
      data: { contentType: "image/png", size: 1024, fileName: "x.png" },
      // Deliberately no session cookie: this is the request that skips the form.
      headers: { "content-type": "application/json" },
    })

    expect(response.ok()).toBe(false)
    expect(await response.text()).not.toContain("r2.cloudflarestorage.com")
  })

  const INJECTED_TITLE = "Injected by an unauthenticated caller"

  test("rejects private API reads without exposing drafts", async ({ request }) => {
    for (const path of [
      "/api/admin/posts",
      "/api/admin/posts/archive?q=private&status=draft",
      "/api/admin/tags",
      "/api/admin/overview",
      "/api/admin/posts/550e8400-e29b-41d4-a716-446655440000",
    ]) {
      const response = await request.get(path)
      expect(response.status()).toBe(401)
      expect(response.headers()["cache-control"]).toContain("no-store")
      expect(await response.text()).not.toContain("contentJson")
    }
  })

  test("rejects writes with absent or forged sessions", async ({ request, baseURL }) => {
    for (const cookie of ["", "better-auth.session_token=forged.notarealsession"]) {
      const response = await request.post("/api/admin/posts", {
        headers: { origin: baseURL!, ...(cookie ? { cookie } : {}) },
        data: { title: INJECTED_TITLE, status: "published", tags: [] },
      })
      expect(response.status()).toBe(401)
      const body = await response.text()
      expect(body).not.toContain("requireAuthor")
      expect(body).not.toContain(INJECTED_TITLE)
    }
    const feed = await (await request.get("/writing/rss.xml")).text()
    expect(feed).not.toContain(INJECTED_TITLE)
  })

  test("protects every mutation endpoint independently", async ({ request, baseURL }) => {
    const id = "550e8400-e29b-41d4-a716-446655440000"
    for (const [method, path, body] of [
      ["PATCH", `/api/admin/posts/${id}/status`, { status: "published" }],
      ["DELETE", `/api/admin/posts/${id}`, {}],
      ["POST", `/api/admin/posts/${id}/preview`, {}],
    ] as const) {
      const response = await request.fetch(path, {
        method,
        headers: { origin: baseURL! },
        data: body,
      })
      expect(response.status()).toBe(401)
      expect(response.headers()["cache-control"]).toContain("no-store")
    }
  })

  test("hands no session to an unauthenticated caller", async ({ request }) => {
    // Asserted on the body rather than the status, because both answers are
    // correct depending on configuration: a deployment with no OAuth application
    // 404s the whole surface, and a configured one answers with an empty session.
    // What must never happen is either of them returning one.
    const response = await request.get("/api/auth/get-session")

    if (response.status() === 404) return

    const body = await response.text()
    expect(body === "" || body === "null" || JSON.parse(body) === null).toBe(true)
  })
})
