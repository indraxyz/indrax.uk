import { expect, test, type BrowserContext } from "@playwright/test"

import { E2E_BASE_URL } from "./support/constants"
import { mintAuthorSession, revokeAuthorSession, SESSION_COOKIE_SECURE } from "./support/session"

/**
 * The authoring loop, driven as the author.
 *
 * Everything the admin does happens behind a session, so none of it was reachable
 * from a test until `support/session.ts` could mint one. That gap let a real bug
 * ship for a whole phase - a raw `= any(...)` array query that made `/admin`
 * answer 500 the moment it was first opened by a signed-in user - which is
 * exactly the argument for this file existing.
 *
 * Skipped unless a database and auth are configured, like the other content
 * specs, so a fresh clone still runs a green suite.
 */
test.describe("authoring", () => {
  test.skip(
    !process.env.DATABASE_URL || !process.env.BETTER_AUTH_SECRET,
    "needs a database and BETTER_AUTH_SECRET - see README"
  )

  // Serial: these tests share one post, and the point is the lifecycle rather
  // than each step in isolation.
  test.describe.configure({ mode: "serial" })

  const TITLE = `A post written by the suite ${Date.now()}`
  const SLUG_PATTERN = /a-post-written-by-the-suite-\d+/

  let context: BrowserContext
  let authorId = ""
  let postPath = ""

  test.beforeAll(async ({ browser }) => {
    const { cookieValue, userId } = await mintAuthorSession()
    authorId = userId

    context = await browser.newContext()
    await context.addCookies([
      {
        name: SESSION_COOKIE_SECURE,
        value: cookieValue,
        domain: new URL(E2E_BASE_URL).hostname,
        path: "/",
        // `npm run start` runs in production mode, which is what puts the
        // `__Secure-` prefix on the name and requires this flag.
        secure: true,
        httpOnly: true,
        sameSite: "Strict",
      },
    ])
  })

  test.afterAll(async () => {
    await context?.close()
    // The identity was created for this run and has no business outliving it.
    if (authorId) await revokeAuthorSession(authorId)
  })

  test("lists existing posts, drafts included", async () => {
    const page = await context.newPage()
    await page.goto("/admin")

    await expect(page).toHaveURL(/\/admin$/)
    // The draft the seed creates is only visible here - it 404s everywhere public.
    await expect(
      page.getByText("notes-on-preview-tokens").or(page.getByText(/preview tokens/i))
    ).toBeVisible()
    await page.close()
  })

  test("writes a post and saves it as a draft", async () => {
    const page = await context.newPage()
    const errors: string[] = []
    page.on("pageerror", (error) => errors.push(String(error)))

    await page.goto("/admin/new")
    await page.waitForSelector(".ProseMirror")

    await page.getByLabel("Title").fill(TITLE)
    await page.locator(".ProseMirror").click()
    await page.keyboard.type("The opening paragraph, typed by the suite.")
    await page.keyboard.press("Enter")
    await page.getByRole("button", { name: "Heading 2" }).click()
    await page.keyboard.type("A section")
    await page.getByLabel("Tags").fill("Testing, typescript")

    await page.getByRole("button", { name: /^save$/i }).click()
    await page.waitForURL(/\/admin\/edit\//)

    // The slug is derived from the title, server-side.
    await expect(page.getByLabel("Slug")).toHaveValue(SLUG_PATTERN)
    expect(errors).toEqual([])

    postPath = new URL(page.url()).pathname
    await page.close()
  })

  test("keeps the unpublished post out of every public surface", async ({ request }) => {
    const page = await context.newPage()
    await page.goto(postPath)
    const slug = await page.getByLabel("Slug").inputValue()
    await page.close()

    expect((await request.get(`/blog/${slug}`)).status()).toBe(404)
    expect(await (await request.get("/rss.xml")).text()).not.toContain(TITLE)
    expect(await (await request.get("/sitemap.xml")).text()).not.toContain(slug)
  })

  test("shares a draft through a signed, expiring preview link", async () => {
    const page = await context.newPage()

    await page.goto(postPath)
    await page.getByRole("button", { name: /preview link/i }).click()

    // Read from the field rather than the clipboard: whether the clipboard write
    // succeeds depends on browser policy, and the field is what an author would
    // actually copy from when it does not.
    const field = page.getByLabel("Preview link")
    await expect(field).toHaveValue(/\/blog\/.+\/preview\?token=/, { timeout: 15_000 })
    const previewUrl = await field.inputValue()

    // A fresh context: the link has to work for whoever it is sent to, and that
    // person has no session.
    const anonymous = await page.context().browser()!.newContext()
    const reader = await anonymous.newPage()

    const response = await reader.goto(previewUrl)
    expect(response?.status()).toBe(200)
    await expect(reader.getByRole("status")).toContainText(/draft preview/i)
    await expect(reader.getByRole("heading", { level: 1 })).toHaveText(TITLE)

    // Unpublished work advertises nothing.
    const html = await reader.content()
    expect(html).not.toContain("application/ld+json")
    expect(html).not.toContain("/api/views/")
    await expect(reader.locator('head meta[name="robots"][content*="noindex"]')).toHaveCount(1)

    // A token is for one post. Repointing it at another must fail.
    const token = new URL(previewUrl).searchParams.get("token")!
    const replayed = await reader.goto(
      `/blog/a-database-that-is-allowed-to-be-absent/preview?token=${encodeURIComponent(token)}`
    )
    expect(replayed?.status()).toBe(404)

    // As must tampering with it.
    const tampered = await reader.goto(
      `${previewUrl.slice(0, -1)}${previewUrl.endsWith("A") ? "B" : "A"}`
    )
    expect(tampered?.status()).toBe(404)

    await anonymous.close()
    await page.close()
  })

  test("publishes it, and the public surfaces pick it up", async ({ request }) => {
    const page = await context.newPage()
    await page.goto(postPath)

    const slug = await page.getByLabel("Slug").inputValue()
    await page.getByRole("button", { name: /^publish$/i }).click()
    await expect(page.getByRole("button", { name: /^unpublish$/i })).toBeVisible({
      timeout: 15_000,
    })
    await page.close()

    const article = await request.get(`/blog/${slug}`)
    expect(article.status()).toBe(200)

    const html = await article.text()
    expect(html).toContain(TITLE)
    // The tag input said "typescript" in lower case; matching is case-insensitive,
    // so it must join the existing TypeScript tag rather than create a second one.
    expect(html.toLowerCase()).toContain("typescript")

    expect(await (await request.get("/rss.xml")).text()).toContain(TITLE)
    expect(await (await request.get("/sitemap.xml")).text()).toContain(slug)
  })

  test("unpublishes it, and the public surfaces let it go", async ({ request }) => {
    const page = await context.newPage()
    await page.goto(postPath)

    const slug = await page.getByLabel("Slug").inputValue()
    await page.getByRole("button", { name: /^unpublish$/i }).click()
    await expect(page.getByRole("button", { name: /^publish$/i })).toBeVisible({ timeout: 15_000 })
    await page.close()

    expect((await request.get(`/blog/${slug}`)).status()).toBe(404)
    expect(await (await request.get("/rss.xml")).text()).not.toContain(TITLE)
  })

  test("deletes it, after asking", async () => {
    const page = await context.newPage()
    let asked = false
    page.on("dialog", async (dialog) => {
      asked = true
      expect(dialog.message()).toMatch(/cannot be undone/i)
      await dialog.accept()
    })

    await page.goto(postPath)
    await page.getByRole("button", { name: /^delete$/i }).click()
    await page.waitForURL(/\/admin$/)

    // Deleting is the one irreversible action here, so it must not be a single
    // unguarded click.
    expect(asked).toBe(true)
    await expect(page.getByText(TITLE)).toHaveCount(0)
    await page.close()
  })
})
