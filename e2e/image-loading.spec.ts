import { expect, test, type Page } from "@playwright/test"

const imageOrigin = "https://images.example.com"
const picture =
  '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="240"><rect width="480" height="240" fill="green"/></svg>'

async function imagePage(page: Page, site: "public" | "admin") {
  const post = {
    id: "image-loading-fixture",
    slug: "image-loading-fixture",
    title: "Image loading fixture",
    excerpt: null,
    coverUrl: null,
    coverAlt: null,
    status: "draft",
    publishedAt: null,
    updatedAt: "2026-11-04T00:00:00Z",
    readingTime: 2,
    tags: [],
    viewCount: 0,
    seriesContext: null,
    seriesTitle: null,
    seriesDescription: null,
    seriesOrder: null,
    content: {
      type: "doc",
      content: [
        {
          type: "image",
          attrs: {
            src: `${imageOrigin}/delayed.svg`,
            alt: "Delayed illustration",
            width: 480,
            height: 240,
          },
        },
        { type: "paragraph" },
      ],
    },
  }
  if (site === "public") {
    await page.route("**/api/writing/preview/image-loading-fixture*", (route) =>
      route.fulfill({
        json: {
          post,
          article: {
            headings: [],
            html: `<p><img src="${imageOrigin}/delayed.svg" alt="Delayed illustration" width="480" height="240"></p>`,
          },
        },
      })
    )
    await page.goto("/writing/image-loading-fixture/preview?token=browser-fixture", {
      waitUntil: "domcontentloaded",
    })
  } else {
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
          author: { id: "fixture", name: "Author", email: "author@example.test" },
          authConfigured: true,
          databaseConfigured: true,
          coverUploadsConfigured: false,
          previewConfigured: true,
        },
      })
    )
    await page.route("**/api/admin/tags", (route) => route.fulfill({ json: [] }))
    await page.route("**/api/admin/posts/image-loading-fixture", (route) =>
      route.fulfill({ json: post })
    )
    await page.goto("/admin/posts/edit/image-loading-fixture", { waitUntil: "domcontentloaded" })
  }
  return page.getByRole("img", { name: "Delayed illustration", exact: true })
}

for (const site of ["public", "admin"] as const) {
  test(`${site} images stay soft until loaded, preserve dimensions and recover after source errors`, async ({
    page,
  }) => {
    let release!: () => void
    const ready = new Promise<void>((resolve) => (release = resolve))
    let requests = 0
    await page.route(`${imageOrigin}/delayed.svg`, async (route) => {
      requests += 1
      await ready
      await route.fulfill({ contentType: "image/svg+xml", body: picture })
    })
    await page.route(`${imageOrigin}/broken.svg`, (route) =>
      route.fulfill({ status: 404, body: "Missing image" })
    )
    await page.route(`${imageOrigin}/retry.svg`, (route) =>
      route.fulfill({ contentType: "image/svg+xml", body: picture })
    )
    const image = await imagePage(page, site)
    await expect(image).toHaveAttribute("data-image-state", "loading")
    await expect(image).toHaveCSS("filter", "blur(8px)")
    const bounds = (await image.boundingBox())!
    expect(bounds.height).toBeGreaterThan(0)
    release()
    await expect(image).toHaveAttribute("data-image-state", "ready")
    await expect(image).toHaveCSS("filter", "none")
    await expect(image).toHaveCSS("opacity", "1")
    const loaded = (await image.boundingBox())!
    expect(Math.abs(loaded.height - bounds.height)).toBeLessThanOrEqual(1)
    expect(requests).toBe(1)
    await expect(image).toHaveAttribute("alt", "Delayed illustration")

    await image.evaluate(
      (node, source) => ((node as HTMLImageElement).src = source),
      `${imageOrigin}/broken.svg`
    )
    await expect(image).toHaveAttribute("data-image-state", "error")
    await expect(image).toHaveCSS("filter", "none")
    await expect(image).toHaveCSS("opacity", "1")
    await image.evaluate(
      (node, source) => ((node as HTMLImageElement).src = source),
      `${imageOrigin}/retry.svg`
    )
    await expect(image).toHaveAttribute("data-image-state", "ready")
    expect(await image.evaluate((node) => (node as HTMLImageElement).naturalWidth)).toBe(480)
  })

  test(`${site} cached images are sharp and reduced motion disables image transitions`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.route(`${imageOrigin}/delayed.svg`, (route) =>
      route.fulfill({ contentType: "image/svg+xml", body: picture })
    )
    const image = await imagePage(page, site)
    await expect(image).toHaveAttribute("data-image-state", "ready")
    await expect(image).toHaveCSS("transition-property", "none")
    await page.evaluate(async (svg) => {
      const cached = new Image()
      cached.alt = "Cached illustration"
      cached.width = 480
      cached.height = 240
      cached.src = `data:image/svg+xml,${encodeURIComponent(svg)}`
      await cached.decode()
      document.querySelector("main")!.appendChild(cached)
    }, picture)
    const cached = page.getByRole("img", { name: "Cached illustration", exact: true })
    await expect(cached).toHaveAttribute("data-image-state", "ready")
    await expect(cached).toHaveCSS("filter", "none")
    await expect(cached).toHaveCSS("opacity", "1")
  })
}

test("image decode completion cannot overwrite a newer failed source", async ({ page }) => {
  await page.addInitScript(() => {
    const nativeDecode = HTMLImageElement.prototype.decode
    HTMLImageElement.prototype.decode = function () {
      const decoded = nativeDecode.call(this)
      if (!this.src.endsWith("/delayed.svg")) return decoded
      return decoded.then(
        () =>
          new Promise<void>((resolve) => {
            Reflect.set(window, "releaseFixtureDecode", resolve)
          })
      )
    }
  })
  let release!: () => void
  const response = new Promise<void>((resolve) => (release = resolve))
  await page.route(`${imageOrigin}/delayed.svg`, async (route) => {
    await response
    await route.fulfill({ contentType: "image/svg+xml", body: picture })
  })
  await page.route(`${imageOrigin}/broken.svg`, (route) =>
    route.fulfill({ status: 404, body: "Missing image" })
  )
  try {
    const image = await imagePage(page, "public")
    await expect(image).toHaveAttribute("data-image-state", "loading")
    release()
    await page.waitForFunction(
      () => typeof Reflect.get(window, "releaseFixtureDecode") === "function"
    )
    await expect(image).toHaveAttribute("data-image-state", "loading")
    await image.evaluate(
      (node, source) => ((node as HTMLImageElement).src = source),
      `${imageOrigin}/broken.svg`
    )
    await expect(image).toHaveAttribute("data-image-state", "error")
    await page.evaluate(async () => {
      Reflect.get(window, "releaseFixtureDecode")()
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    })
    await expect(image).toHaveAttribute("data-image-state", "error")
    await expect(image).toHaveCSS("filter", "none")
  } finally {
    release()
  }
})
