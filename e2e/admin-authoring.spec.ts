import { neon } from "@neondatabase/serverless"
import { expect, test, type BrowserContext, type Page } from "@playwright/test"

import {
  E2E_BASE_URL,
  SEEDED_DRAFT_TITLE,
  SEEDED_SECOND_POST_SLUG,
  SEEDED_SERIES_TITLE,
} from "./support/constants"
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
  const TAG = `authoring-regression-${Date.now()}`
  const TAG_PATH = `/writing/tags/${TAG}`

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

  async function expectOverview(page: Page) {
    const databaseUrl = process.env.DATABASE_URL!
    expect(["localhost", "127.0.0.1", "[::1]"]).toContain(new URL(databaseUrl).hostname)
    // An independent row read verifies aggregate counts against actual state,
    // including lifecycle changes; it never touches shared seed data.
    const sql = neon(databaseUrl)
    const rows = await sql`select id, title, status from posts order by updated_at desc`
    const summary = page.locator('section[aria-labelledby="posts-heading"]')
    for (const [label, value] of [
      ["All posts", rows.length],
      ["Published", rows.filter((row) => row.status === "published").length],
      ["Drafts", rows.filter((row) => row.status === "draft").length],
      ["Archived", rows.filter((row) => row.status === "archived").length],
    ] as const) {
      const card = summary
        .locator("div.border-2")
        .filter({ has: page.getByText(label, { exact: true }) })
      await expect(card.locator("p").last()).toHaveText(String(value))
    }
    const latestDraft = rows.find((row) => row.status === "draft")
    if (latestDraft) {
      await expect(page.getByRole("link", { name: "Edit draft", exact: true })).toHaveAttribute(
        "href",
        `/admin/edit/${latestDraft.id}`
      )
      await expect(page.locator('section[aria-labelledby="next-heading"]')).toContainText(
        latestDraft.title
      )
    }
  }

  test("serves admin as a static shell and gets private data only through the API", async () => {
    const response = await context.request.get("/admin/posts")
    expect(response.status()).toBe(200)
    const html = await response.text()
    expect(html).toContain('<div id="root">')
    expect(html).toContain('aria-label="Loading page"')
    expect(html).not.toContain(SEEDED_DRAFT_TITLE)
    expect(html).not.toContain("ProseMirror")
    const page = await context.newPage()
    const apiRead = page.waitForResponse(
      (response) => new URL(response.url()).pathname === "/api/admin/posts"
    )
    await page.goto("/admin/posts")
    expect((await apiRead).status()).toBe(200)
    await expect(page.getByRole("link", { name: SEEDED_DRAFT_TITLE, exact: true })).toBeVisible()
    await page.close()
  })

  test("lists existing posts, drafts included", async () => {
    const page = await context.newPage()
    await page.goto("/admin")

    await expect(page).toHaveURL(/\/admin$/)
    await expect(page.getByRole("navigation", { name: "Breadcrumb", exact: true })).toHaveCount(0)
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible()
    await expectOverview(page)
    await expect(
      page.getByRole("navigation", { name: "Admin" }).getByRole("link", { name: "Resume" })
    ).toHaveAttribute("href", "/resume")
    await expect(
      page.getByRole("navigation", { name: "Admin" }).getByRole("link", { name: "Admin home" })
    ).toHaveAttribute("href", "/admin")
    await page
      .getByRole("navigation", { name: "Admin" })
      .getByRole("link", { name: "Posts" })
      .click()
    await expect(page).toHaveURL(/\/admin\/posts$/)
    const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb", exact: true })
    await expect(breadcrumb.locator('[aria-current="page"]')).toHaveText("Posts")
    await breadcrumb.getByRole("link", { name: "Admin", exact: true }).click()
    await expect(page).toHaveURL(/\/admin$/)
    await page.goto("/admin/posts")
    await expect(page.getByRole("link", { name: "Admin home" })).toHaveAttribute("href", "/admin")
    await expect(
      page
        .getByRole("navigation", { name: "Admin", exact: true })
        .getByRole("link", { name: "Writing", exact: true })
    ).toHaveAttribute("href", "/writing")
    // The draft the seed creates is only visible here - it 404s everywhere public.
    // Matched on its exact title: each row renders the title as a link *and* an
    // "Edit <title>" control, so a loose match finds both.
    await expect(page.getByRole("link", { name: SEEDED_DRAFT_TITLE, exact: true })).toBeVisible()
    await page.close()
  })

  test("edits table structure and keeps controls in sync with the selection", async () => {
    const page = await context.newPage()
    await page.goto("/admin/new")
    const body = page.locator(".ProseMirror")
    await expect(body).toBeVisible()
    await expect(page.getByRole("toolbar", { name: "Table editing" })).toHaveCount(0)
    await body.click()
    await page.getByRole("button", { name: "Table", exact: true }).click()
    const table = body.locator("table")
    const tools = page.getByRole("toolbar", { name: "Table editing" })
    await expect(table.locator("tr")).toHaveCount(3)
    await expect(table.locator("tr").first().locator("th")).toHaveCount(3)
    await expect(tools).toBeVisible()
    for (const button of await tools.getByRole("button").all()) {
      const label = await button.getAttribute("aria-label")
      expect(label).toBeTruthy()
      await expect(button).toHaveAttribute("title", label!)
      await expect(button.locator("svg").first()).toBeVisible()
      await expect(button).toHaveText("")
    }
    await expect(page.getByRole("button", { name: "Table", exact: true })).toBeDisabled()
    await expect(tools.getByRole("button", { name: "Merge cells", exact: true })).toBeDisabled()
    await expect(tools.getByRole("button", { name: "Split cell", exact: true })).toBeDisabled()

    for (const action of ["Add row above", "Add row below"]) {
      await tools.getByRole("button", { name: action, exact: true }).click()
    }
    await expect(table.locator("tr")).toHaveCount(5)
    await tools.getByRole("button", { name: "Delete row", exact: true }).click()
    await expect(table.locator("tr")).toHaveCount(4)
    for (const action of ["Add column before", "Add column after"]) {
      await tools.getByRole("button", { name: action, exact: true }).click()
    }
    await expect(table.locator("tr").first().locator("th, td")).toHaveCount(5)
    await tools.getByRole("button", { name: "Delete column", exact: true }).click()
    await expect(table.locator("tr").first().locator("th, td")).toHaveCount(4)

    // Header row/column controls toggle the table headers; the cell toggle follows the caret.
    await table.locator("tr").last().locator("td").first().click()
    // Deleting the original selected row above also removed the original header.
    await expect(table.locator("tr").first().locator("th")).toHaveCount(0)
    await tools.getByRole("button", { name: "Toggle header row", exact: true }).click()
    await expect(table.locator("tr").first().locator("th")).toHaveCount(4)
    await tools.getByRole("button", { name: "Toggle header row", exact: true }).click()
    await expect(table.locator("tr").first().locator("th")).toHaveCount(0)
    await tools.getByRole("button", { name: "Toggle header column", exact: true }).click()
    await expect(table.locator("tr").last().locator("th")).toHaveCount(1)
    await tools.getByRole("button", { name: "Toggle header column", exact: true }).click()
    await tools.getByRole("button", { name: "Toggle header cell", exact: true }).click()
    await expect(table.locator("tr").last().locator("th")).toHaveCount(1)
    await tools.getByRole("button", { name: "Toggle header cell", exact: true }).click()

    // Shift-click selects adjacent cells through ProseMirror's real interaction.
    const cells = table.locator("tr").last().locator("td")
    await cells.nth(0).click()
    await cells.nth(1).click({ modifiers: ["Shift"] })
    await expect(tools.getByRole("button", { name: "Merge cells", exact: true })).toBeEnabled()
    await tools.getByRole("button", { name: "Merge cells", exact: true }).click()
    await expect(table.locator('[colspan="2"]')).toHaveCount(1)
    await expect(tools.getByRole("button", { name: "Split cell", exact: true })).toBeEnabled()
    await tools.getByRole("button", { name: "Split cell", exact: true }).click()
    await expect(table.locator('[colspan="2"]')).toHaveCount(0)
    await expect(table.locator("tr").last().locator("td")).toHaveCount(4)
    await page.setViewportSize({ width: 390, height: 844 })
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
    ).toBe(true)
    // Keyboard focus also scrolls the contextual control rail into view on mobile.
    const deleteTable = tools.getByRole("button", { name: "Delete table", exact: true })
    await deleteTable.focus()
    await expect(deleteTable).toBeInViewport()
    await page.keyboard.press("Enter")
    await expect(table).toHaveCount(0)
    await expect(tools).toHaveCount(0)
    await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeEnabled()
    await page.getByRole("button", { name: "Undo", exact: true }).click()
    await expect(table.locator("tr")).toHaveCount(4)
    await page.getByRole("button", { name: "Redo", exact: true }).click()
    await expect(table).toHaveCount(0)
    await page.close()
  })

  test("keeps formatting visible below the admin header while scrolling long content", async () => {
    const page = await context.newPage()
    await page.goto("/admin/new")
    const body = page.locator(".ProseMirror")
    await expect(body).toBeVisible()
    await body.fill(
      Array.from({ length: 80 }, (_, i) => `Paragraph ${i + 1}: Long article content.`).join("\n")
    )
    for (const viewport of [
      { width: 1280, height: 800 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport)
      await page.evaluate(() => window.scrollTo(0, 1000))
      const formatting = page.getByRole("toolbar", { name: "Formatting", exact: true })
      await expect
        .poll(async () => {
          const header = await page.locator("[data-admin-header]").boundingBox()
          const toolbar = await formatting.boundingBox()
          return header && toolbar ? Math.abs(toolbar.y - (header.y + header.height)) : Infinity
        })
        .toBeLessThan(2)
      await expect(formatting.getByRole("button", { name: "Bold", exact: true })).toBeInViewport()
      await formatting.getByRole("button", { name: "Bold", exact: true }).click()
      await expect(formatting.getByRole("button", { name: "Bold", exact: true })).toHaveAttribute(
        "aria-pressed",
        "true"
      )
      await formatting.getByRole("button", { name: "Bold", exact: true }).click()
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
      ).toBe(true)
    }
    await page.close()
  })

  test("disables cover controls when media storage is unavailable", async () => {
    test.skip(
      Boolean(
        process.env.R2_ACCOUNT_ID &&
        process.env.R2_ACCESS_KEY_ID &&
        process.env.R2_SECRET_ACCESS_KEY &&
        process.env.R2_BUCKET &&
        process.env.NEXT_PUBLIC_MEDIA_ORIGIN
      ),
      "run with R2 variables explicitly empty"
    )
    const page = await context.newPage()
    await page.goto("/admin/new")
    const cover = page.getByRole("group", { name: "Cover image", exact: true })
    await expect(cover).toHaveAttribute("disabled", "")
    await expect(cover.getByLabel("Cover image URL")).toBeDisabled()
    await expect(cover.getByLabel("Cover alt text")).toBeDisabled()
    await expect(cover.getByRole("button", { name: "Upload a cover" })).toBeDisabled()
    await expect(cover.locator('input[type="file"]')).toBeDisabled()
    await expect(cover).toContainText(/unavailable/i)
    await expect(page.getByRole("button", { name: /^save$/i })).toBeEnabled()
    await page.close()
  })

  test("enables cover controls when media storage is configured", async () => {
    test.skip(
      !process.env.R2_ACCOUNT_ID ||
        !process.env.R2_ACCESS_KEY_ID ||
        !process.env.R2_SECRET_ACCESS_KEY ||
        !process.env.R2_BUCKET ||
        !process.env.NEXT_PUBLIC_MEDIA_ORIGIN,
      "run with dummy R2 settings and a valid HTTPS media origin"
    )
    const page = await context.newPage()
    await page.goto("/admin/new")
    const cover = page.getByRole("group", { name: "Cover image", exact: true })
    await expect(cover).not.toHaveAttribute("disabled", "")
    await expect(cover.getByLabel("Cover image URL")).toBeEnabled()
    await expect(cover.getByLabel("Cover alt text")).toBeEnabled()
    await expect(cover.getByRole("button", { name: "Upload a cover" })).toBeEnabled()
    await expect(cover.locator('input[type="file"]')).toBeEnabled()
    await cover.getByLabel("Cover image URL").fill("https://media.example.com/cover.png")
    await cover.getByLabel("Cover alt text").fill("A configured cover")
    await expect(cover.getByLabel("Cover image URL")).toHaveValue(
      "https://media.example.com/cover.png"
    )
    await expect(cover.getByLabel("Cover alt text")).toHaveValue("A configured cover")
    await expect(cover).not.toContainText(/unavailable/i)
    await page.close()
  })

  test("writes a post and saves it as a draft", async () => {
    const page = await context.newPage()
    const errors: string[] = []
    page.on("pageerror", (error) => errors.push(String(error)))

    await page.goto("/admin/new")
    const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb", exact: true })
    await expect(breadcrumb.locator("li")).toHaveText(["Admin", "Posts", "New post"])
    await expect(breadcrumb.getByRole("link", { name: "Posts", exact: true })).toHaveAttribute(
      "href",
      "/admin/posts"
    )
    await page.waitForSelector(".ProseMirror")

    // Exact, because the series fieldset adds a "Series title" field and the
    // default substring match resolves to both.
    await page.getByLabel("Title", { exact: true }).fill(TITLE)
    await page.locator(".ProseMirror").click()
    await page.keyboard.type("The opening paragraph, typed by the suite.")
    await page.keyboard.press("Enter")
    await page.getByRole("button", { name: "Heading 2" }).click()
    await page.keyboard.type("A section")
    await page.keyboard.press("Enter")
    await page.getByRole("button", { name: "Table", exact: true }).click()
    await page.getByRole("button", { name: "Add row below", exact: true }).click()
    await page.getByRole("button", { name: "Add column after", exact: true }).click()
    await page.getByLabel("Tags").fill(`Testing, typescript, ${TAG}`)

    await page.getByRole("button", { name: /^save$/i }).click()
    await page.waitForURL(/\/admin\/edit\//)
    await expect(breadcrumb.locator("li")).toHaveText(["Admin", "Posts", "Edit post"])

    // The slug is derived from the title, server-side.
    await expect(page.getByLabel("Slug")).toHaveValue(SLUG_PATTERN)
    expect(errors).toEqual([])

    postPath = new URL(page.url()).pathname
    await page.goto("/admin")
    await expectOverview(page)
    await expect(page.getByRole("link", { name: "Edit draft", exact: true })).toHaveAttribute(
      "href",
      postPath
    )
    await page.close()
  })

  test("preserves an existing cover when saving with storage unavailable", async () => {
    test.skip(Boolean(process.env.R2_ACCOUNT_ID), "run with R2 variables explicitly empty")
    const databaseUrl = process.env.DATABASE_URL!
    expect(["localhost", "127.0.0.1", "[::1]"]).toContain(new URL(databaseUrl).hostname)
    // Only the post created by this lifecycle is modified, never a shared seed.
    // mintAuthorSession has already configured the local Neon HTTP endpoint.
    const sql = neon(databaseUrl)
    const id = postPath.split("/").at(-1)!
    const coverUrl = "https://media.example.com/existing-cover.webp"
    const coverAlt = "An existing cover"
    await sql`UPDATE posts SET cover_url = ${coverUrl}, cover_alt = ${coverAlt} WHERE id = ${id}`
    const page = await context.newPage()
    await page.goto(postPath)
    const cover = page.getByRole("group", { name: "Cover image", exact: true })
    await expect(cover).toHaveAttribute("disabled", "")
    await expect(cover.getByLabel("Cover image URL")).toHaveValue(coverUrl)
    await expect(cover.getByLabel("Cover alt text")).toHaveValue(coverAlt)
    await page.getByLabel("Excerpt").fill("Updated with media storage unavailable.")
    await page.getByRole("button", { name: /^save$/i }).click()
    await expect(page.getByText("Saved.", { exact: true })).toBeVisible()
    await page.reload()
    await expect(page.getByLabel("Excerpt")).toHaveValue("Updated with media storage unavailable.")
    await expect(cover.getByLabel("Cover image URL")).toHaveValue(coverUrl)
    await expect(cover.getByLabel("Cover alt text")).toHaveValue(coverAlt)
    await page.close()
  })

  test("keeps the unpublished post out of every public surface", async ({ request }) => {
    const page = await context.newPage()
    await page.goto(postPath)
    const slug = await page.getByLabel("Slug").inputValue()
    await expect(page.locator(".ProseMirror table tr")).toHaveCount(4)
    await expect(page.locator(".ProseMirror table tr").first().locator("th, td")).toHaveCount(4)
    if (!process.env.R2_ACCOUNT_ID) {
      await expect(page.getByRole("group", { name: "Cover image", exact: true })).toHaveAttribute(
        "disabled",
        ""
      )
    }
    await page.close()

    expect((await request.get(`/writing/${slug}`)).status()).toBe(404)
    // A CSR tag document contains no private data. Its public API remains empty
    // until an article is published, including after the shell has been warmed.
    expect((await request.get(TAG_PATH)).status()).toBe(200)
    expect((await (await request.get(`/api/writing/posts?tag=${TAG}`)).json()).posts).toEqual([])
    const publicPage = await context.newPage()
    await publicPage.goto(TAG_PATH)
    await expect(publicPage.getByRole("heading", { name: "Not found", exact: true })).toBeVisible()
    await expect(publicPage.locator('head meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/
    )
    await publicPage.close()
    expect(await (await request.get("/writing/rss.xml")).text()).not.toContain(TITLE)
    expect(await (await request.get("/sitemap.xml")).text()).not.toContain(slug)
  })

  test("shares a draft through a signed, expiring preview link", async ({ browser }) => {
    const page = await context.newPage()

    await page.goto(postPath)
    await page.getByRole("button", { name: /preview link/i }).click()

    // Read from the field rather than the clipboard: whether the clipboard write
    // succeeds depends on browser policy, and the field is what an author would
    // actually copy from when it does not.
    const field = page.getByLabel("Preview link")
    await expect(field).toHaveValue(/\/writing\/.+\/preview\?token=/, { timeout: 15_000 })
    const previewUrl = await field.inputValue()

    // A fresh context: the link has to work for whoever it is sent to, and that
    // person has no session.
    const anonymous = await browser.newContext()
    const reader = await anonymous.newPage()

    const response = await reader.goto(previewUrl)
    expect(response?.status()).toBe(200)
    await expect(reader.getByRole("status").filter({ hasText: /draft preview/i })).toBeVisible()
    const breadcrumb = reader.getByRole("navigation", { name: "Breadcrumb", exact: true })
    await expect(breadcrumb.locator('[aria-current="page"]')).toHaveText(`Preview: ${TITLE}`)
    await expect(breadcrumb.getByRole("link")).toHaveCount(2)
    await expect(reader.getByRole("heading", { level: 1 })).toHaveText(TITLE)

    // Unpublished work advertises nothing.
    const html = await reader.content()
    expect(html).not.toContain("application/ld+json")
    expect(html).not.toContain("/api/views/")
    await expect(reader.locator('head meta[name="robots"][content*="noindex"]')).toHaveCount(1)

    // A token is for one post. Repointing it at another must fail - and the target
    // has to be a post that exists, or a 404 would prove only that it is missing.
    expect((await reader.goto(`/writing/${SEEDED_SECOND_POST_SLUG}`))?.status()).toBe(200)

    const token = new URL(previewUrl).searchParams.get("token") ?? ""
    const replayed = await reader.goto(
      `/writing/${SEEDED_SECOND_POST_SLUG}/preview?token=${encodeURIComponent(token)}`
    )
    expect(replayed?.status()).toBe(200)
    await expect(reader.getByRole("heading", { name: "Not found", exact: true })).toBeVisible()
    expect(
      (
        await reader.request.get(
          `/api/writing/preview/${SEEDED_SECOND_POST_SLUG}?token=${encodeURIComponent(token)}`
        )
      ).status()
    ).toBe(404)

    // As must tampering with it.
    const tampered = await reader.goto(
      `${previewUrl.slice(0, -1)}${previewUrl.endsWith("A") ? "B" : "A"}`
    )
    expect(tampered?.status()).toBe(200)
    await expect(reader.getByRole("heading", { name: "Not found", exact: true })).toBeVisible()
    await expect(reader.getByRole("heading", { name: TITLE, exact: true })).toHaveCount(0)

    await anonymous.close()
    await page.close()
  })

  test("publishes it, and the public surfaces pick it up", async ({ request }) => {
    const page = await context.newPage()
    await page.goto(postPath)

    const slug = await page.getByLabel("Slug").inputValue()
    const extraEditReads: string[] = []
    page.on("request", (request) => {
      if (request.method() === "GET" && new URL(request.url()).pathname === postPath) {
        extraEditReads.push(request.url())
      }
    })
    await page.getByRole("button", { name: /^publish$/i }).click()
    await expect(page.getByRole("button", { name: /^unpublish$/i })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByRole("button", { name: /^unpublish$/i })).toBeEnabled()
    expect(extraEditReads).toEqual([])
    await page.close()

    const article = await request.get(`/writing/${slug}`)
    expect(article.status()).toBe(200)

    const html = await article.text()
    expect(html).toContain(TITLE)
    // The tag input said "typescript" in lower case; matching is case-insensitive,
    // so it must join the existing TypeScript tag rather than create a second one.
    expect(html.toLowerCase()).toContain("typescript")

    expect(await (await request.get("/writing/rss.xml")).text()).toContain(TITLE)
    expect(await (await request.get("/sitemap.xml")).text()).toContain(slug)

    const reader = await context.newPage()
    expect((await reader.goto(TAG_PATH))?.status()).toBe(200)
    await expect(reader.getByRole("link", { name: TITLE, exact: true })).toBeVisible()
    await expect(reader.locator('head link[rel="canonical"]')).toHaveAttribute(
      "href",
      new RegExp(`${TAG_PATH}$`)
    )
    await expect(reader.locator('head meta[name="robots"][content*="noindex"]')).toHaveCount(0)
    await reader.close()
  })

  test("revisits a tag after saving and keeps query pagination canonical", async () => {
    const page = await context.newPage()
    await page.goto(TAG_PATH)
    await expect(page.getByRole("link", { name: TITLE, exact: true })).toBeVisible()

    // Exercise invalidation of an already visited public tag from the same
    // authenticated authoring flow that previously caused production errors.
    await page.goto(postPath)
    const excerpt = "A published edit reflected in the tag archive."
    const articlePath = `/writing/${await page.getByLabel("Slug").inputValue()}`
    // Warm the public render cache before changing its saved revision.
    expect((await page.request.get(articlePath)).status()).toBe(200)
    const bodyMarker = "A new saved body must replace the previously cached article."
    await page.locator(".ProseMirror").press("ControlOrMeta+End")
    await page.keyboard.press("Enter")
    await page.keyboard.insertText(bodyMarker)
    await page.getByLabel("Excerpt").fill(excerpt)
    await page.getByRole("button", { name: /^save$/i }).click()
    await expect(page.getByText("Saved.", { exact: true })).toBeVisible()
    expect((await page.goto(TAG_PATH))?.status()).toBe(200)
    await expect(page.getByText(excerpt, { exact: true })).toBeVisible()
    expect((await page.reload())?.status()).toBe(200)
    await expect(page.getByText(excerpt, { exact: true })).toBeVisible()

    expect((await page.goto(`${TAG_PATH}?page=2`))?.status()).toBe(200)
    await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute(
      "href",
      new RegExp(`${TAG_PATH}\\?page=2$`)
    )
    expect((await page.goto(articlePath))?.status()).toBe(200)
    await expect(page.locator(".prose")).toContainText(bodyMarker)
    expect((await page.reload())?.status()).toBe(200)
    await expect(page.locator(".prose")).toContainText(bodyMarker)
    await page.close()
  })

  test("unpublishes it, and the public surfaces let it go", async ({ request }) => {
    const page = await context.newPage()
    await page.goto(postPath)

    const slug = await page.getByLabel("Slug").inputValue()
    const extraEditReads: string[] = []
    page.on("request", (request) => {
      if (request.method() === "GET" && new URL(request.url()).pathname === postPath) {
        extraEditReads.push(request.url())
      }
    })
    await page.getByRole("button", { name: /^unpublish$/i }).click()
    await expect(page.getByRole("button", { name: /^publish$/i })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole("button", { name: /^publish$/i })).toBeEnabled()
    expect(extraEditReads).toEqual([])
    await page.close()

    expect((await request.get(`/writing/${slug}`)).status()).toBe(404)
    expect((await request.get(TAG_PATH)).status()).toBe(200)
    expect((await (await request.get(`/api/writing/posts?tag=${TAG}`)).json()).posts).toEqual([])
    expect(await (await request.get("/writing/rss.xml")).text()).not.toContain(TITLE)
  })

  test("refuses a part number another article already holds", async () => {
    const page = await context.newPage()

    await page.goto(postPath)
    await page.getByLabel("Series title").fill(SEEDED_SERIES_TITLE)
    // Part one of the seeded series is taken. A partial unique index is what
    // actually enforces that - an application check would lose the race between
    // two saves - so this is really asking whether the 23505 it raises reaches
    // the author as a field error rather than as a 500 with a masked digest.
    await page.getByLabel("Part number").fill("1")
    await page.getByRole("button", { name: /^save$/i }).click()

    await expect(page.getByText(/part 1 of that series already exists/i)).toBeVisible({
      timeout: 15_000,
    })

    // Put it back, so the lifecycle below is unaffected by this detour.
    await page.getByLabel("Series title").fill("")
    await page.getByLabel("Part number").fill("")
    await page.getByRole("button", { name: /^save$/i }).click()
    await expect(page.getByText(/part 1 of that series already exists/i)).toHaveCount(0, {
      timeout: 15_000,
    })

    await page.close()
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
    await page.waitForURL(/\/admin\/posts$/)

    // Deleting is the one irreversible action here, so it must not be a single
    // unguarded click.
    expect(asked).toBe(true)
    await expect(page.getByText(TITLE)).toHaveCount(0)
    await page.close()
  })
})
