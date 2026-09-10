import { readFileSync } from "node:fs"
import { join } from "node:path"

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
  const GUARDED = ["/admin", "/admin/new", "/admin/edit/some-id"]

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

  /**
   * A real action id from the build's own manifest.
   *
   * Invented ids are rejected by Next before any application code runs, so a test
   * using one passes while proving nothing about the guard.
   */
  function mutationActionId(): string {
    const manifest = JSON.parse(
      readFileSync(join(process.cwd(), ".next/server/server-reference-manifest.json"), "utf8")
    ) as { node: Record<string, { filename?: string }> }

    const id = Object.entries(manifest.node).find(([, entry]) =>
      entry.filename?.includes("features/blog/data/mutations")
    )?.[0]

    if (!id) throw new Error("No mutation action found in the build manifest.")

    return id
  }

  const INJECTED_TITLE = "Injected by an unauthenticated caller"

  async function assertNothingWasWritten(request: import("@playwright/test").APIRequestContext) {
    const feed = await (await request.get("/rss.xml")).text()
    expect(feed).not.toContain(INJECTED_TITLE)

    const sitemap = await (await request.get("/sitemap.xml")).text()
    expect(sitemap).not.toContain("injected-by-an-unauthenticated-caller")
  }

  test("turns a server action away at the proxy when no cookie is present", async ({ request }) => {
    const response = await request.post("/admin/new", {
      maxRedirects: 0,
      headers: {
        "content-type": "text/plain;charset=UTF-8",
        "next-action": mutationActionId(),
      },
      data: JSON.stringify([{ title: INJECTED_TITLE, status: "published", tags: [] }]),
    })

    expect(response.status()).toBe(307)
    expect(response.headers().location).toContain("/admin/login")
    await assertNothingWasWritten(request)
  })

  test("rejects a server action independently of the proxy", async ({ request }) => {
    // `proxy.ts` only checks that a session cookie is *present*, so a forged one
    // walks straight past it and reaches the action. That is deliberate - the
    // proxy is a redirect for browsers, not a control - and this is the request
    // that proves the real check happens inside the action itself (PRD US-4.2,
    // threat T-3).
    const response = await request.post("/admin/new", {
      maxRedirects: 0,
      headers: {
        "content-type": "text/plain;charset=UTF-8",
        "next-action": mutationActionId(),
        cookie: "better-auth.session_token=forged.notarealsession",
      },
      data: JSON.stringify([{ title: INJECTED_TITLE, status: "published", tags: [] }]),
    })

    const body = await response.text()

    // Next serialises a thrown server action as an error in the RSC stream, so
    // 200 is the normal status here and says nothing. What the response must
    // carry is an error and no result...
    expect(body).toMatch(/"digest"/)
    expect(body).not.toContain(INJECTED_TITLE)
    // ...with no stack trace reaching the caller (PRD US-6.2).
    expect(body).not.toContain("requireAuthor")
    expect(body).not.toContain("at ")

    // ...and, above all, nothing written.
    await assertNothingWasWritten(request)
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
