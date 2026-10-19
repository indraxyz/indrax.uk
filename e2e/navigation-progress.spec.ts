import { expect, test } from "@playwright/test"

test("public hard refresh uses a centered spinner until initial data is ready", async ({
  page,
}) => {
  let release!: () => void
  let ready = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route("**/api/writing/posts*", async (route) => {
    await ready
    await route.fulfill({ json: { posts: [], page: 1, pageCount: 0, total: 0 } })
  })
  await page.route("**/api/writing/tags", (route) => route.fulfill({ json: [] }))
  await page.goto("/writing")
  try {
    const spinner = page.getByRole("status", { name: "Loading page" })
    await expect(spinner).toBeVisible()
    await expect(spinner.locator("svg")).toBeVisible()
    await expect(page.locator(".navigation-progress > div")).toHaveCSS("width", "0px")
  } finally {
    release()
  }
  await expect(page.getByRole("status", { name: "Loading page" })).toHaveCount(0)
  ready = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.reload()
  try {
    await expect(page.getByRole("status", { name: "Loading page" }).locator("svg")).toBeVisible()
  } finally {
    release()
  }
  await expect(page.getByRole("status", { name: "Loading page" })).toHaveCount(0)
})

test("admin hard refresh shows its spinner even before route code loads", async ({ page }) => {
  let release!: () => void
  const ready = new Promise<void>((resolve) => {
    release = resolve
  })
  let releaseSession!: () => void
  const session = new Promise<void>((resolve) => {
    releaseSession = resolve
  })
  await page.route(/\/admin\/assets\/index-[^/]+\.js$/, async (route) => {
    await ready
    await route.continue()
  })
  await page.route("**/api/admin/session", async (route) => {
    await session
    await route.continue()
  })
  await page.goto("/admin/login", { waitUntil: "commit" })
  const boot = page.locator(".admin-boot-loading svg")
  // Both icons spin, so a bounding box grows mid-rotation; the centre and the CSS
  // size do not.
  const geometry = (element: SVGElement | HTMLElement) => {
    const box = element.getBoundingClientRect()
    const style = getComputedStyle(element)
    return {
      x: box.x + box.width / 2,
      y: box.y + box.height / 2,
      width: parseFloat(style.width),
      height: parseFloat(style.height),
    }
  }
  let bootBox: ReturnType<typeof geometry> | null = null
  try {
    await expect(page.locator(".admin-boot-loading")).toBeVisible()
    await expect(boot).toBeVisible()
    // The shared spinner vector, not a second hand-drawn icon.
    await expect(boot).toHaveAttribute("data-loading-icon", "")
    bootBox = await boot.evaluate(geometry)
  } finally {
    release()
  }
  // React's loader takes over in the same place with the same icon and size, so a
  // hard refresh reads as one continuous spinner rather than two.
  try {
    const react = page.locator('[data-slot="loading-indicator"] svg')
    await expect(react).toBeVisible()
    await expect(page.locator(".admin-boot-loading")).toHaveCount(0)
    const reactBox = await react.evaluate(geometry)
    for (const key of ["x", "y", "width", "height"] as const)
      expect(Math.abs(reactBox[key] - bootBox![key])).toBeLessThanOrEqual(1)
  } finally {
    releaseSession()
  }
  await expect(page.locator(".admin-boot-loading")).toHaveCount(0)
  await expect(page.getByRole("status", { name: "Loading page" })).toHaveCount(0)
})

test("a superseded public navigation cannot keep the bar running", async ({ page }) => {
  let release!: () => void
  const ready = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route("**/api/writing/posts*", async (route) => {
    await ready
    await route.fulfill({ json: { posts: [], page: 1, pageCount: 0, total: 0 } })
  })
  await page.route("**/api/writing/tags", (route) => route.fulfill({ json: [] }))
  await page.route("**/api/writing/recent*", (route) => route.fulfill({ json: [] }))
  await page.goto("/")
  await page.getByRole("link", { name: "Writing", exact: true }).first().click()
  try {
    await expect(page.getByRole("status").filter({ hasText: "Loading page" })).toBeVisible()
    await page.getByRole("link", { name: "Resume", exact: true }).first().click()
    await expect(page).toHaveURL(/\/resume$/)
    await expect(page.getByRole("status").filter({ hasText: "Loading page" })).toHaveCount(0)
  } finally {
    release()
  }
})

test("public navigation keeps the current page until writing data is ready", async ({ page }) => {
  let release!: () => void
  const ready = new Promise<void>((resolve) => {
    release = resolve
  })
  let requests = 0
  await page.route("**/api/writing/posts*", async (route) => {
    requests++
    await ready
    await route.fulfill({ json: { posts: [], page: 1, pageCount: 0, total: 0 } })
  })
  await page.route("**/api/writing/tags", (route) => route.fulfill({ json: [] }))
  await page.goto("/")
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Software Engineer")
  await page.getByRole("link", { name: "Writing", exact: true }).first().click()
  try {
    await expect(page.getByRole("status").filter({ hasText: "Loading page" })).toBeVisible()
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Software Engineer")
    await expect(page).toHaveURL(/\/$/)
  } finally {
    release()
  }
  await expect(page).toHaveURL(/\/writing$/)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Writing")
  await expect(page.getByRole("status").filter({ hasText: "Loading page" })).toHaveCount(0)
  expect(requests).toBe(1)
})

test("admin navigation retains the workspace and reuses completed query data", async ({ page }) => {
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
  let release!: () => void
  const ready = new Promise<void>((resolve) => {
    release = resolve
  })
  let requests = 0
  await page.route("**/api/admin/posts/archive*", async (route) => {
    requests++
    await ready
    await route.fulfill({ json: { posts: [], total: 0, page: 1, pageCount: 0 } })
  })
  await page.route("**/api/admin/tags", (route) => route.fulfill({ json: [] }))
  await page.goto("/admin")
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Overview")
  await page.getByRole("link", { name: "Manage posts" }).click()
  try {
    await expect(page.getByRole("status").filter({ hasText: "Loading page" })).toBeVisible()
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Overview")
    await expect(page.getByText("Loading your workspace…")).toHaveCount(0)
    await expect(page.locator("[data-admin-header]")).toBeVisible()
  } finally {
    release()
  }
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Posts")
  await expect(page.getByRole("status").filter({ hasText: "Loading page" })).toHaveCount(0)
  await page.getByRole("link", { name: "Indra's Admin" }).click()
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Overview")
  await page.getByRole("link", { name: "Manage posts" }).click()
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Posts")
  expect(requests).toBe(1)
})

test("failed public data stops the bar and leaves a usable retry", async ({ page }) => {
  await page.route("**/api/writing/posts*", (route) =>
    route.fulfill({ status: 503, json: { error: "Unavailable" } })
  )
  await page.route("**/api/writing/tags", (route) => route.fulfill({ json: [] }))
  await page.goto("/")
  await page.getByRole("link", { name: "Writing", exact: true }).first().click()
  await expect(page.getByRole("alert")).toContainText("Unable to load writing")
  await expect(page.getByRole("status").filter({ hasText: "Loading page" })).toHaveCount(0)
  await page.route("**/api/writing/posts*", (route) =>
    route.fulfill({ json: { posts: [], page: 1, pageCount: 0, total: 0 } })
  )
  await page.getByRole("button", { name: "Try again" }).click()
  await expect(page.getByRole("alert")).toHaveCount(0)
})
