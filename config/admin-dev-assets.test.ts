import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { IncomingMessage, ServerResponse } from "node:http"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { adminDevAssets, createAdminDevAssetsMiddleware } from "./admin-dev-assets"

let root: string
let directory: string
let middleware: ReturnType<typeof createAdminDevAssetsMiddleware>
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "indrax-admin-assets-"))
  directory = join(root, "admin/assets")
  await mkdir(directory, { recursive: true })
  middleware = createAdminDevAssetsMiddleware(directory)
})
afterEach(() => rm(root, { recursive: true, force: true }))

function request(url: string, method = "GET") {
  const headers: Record<string, unknown> = {}
  const response = {
    statusCode: 200,
    setHeader: vi.fn((name: string, value: unknown) => {
      headers[name.toLowerCase()] = value
    }),
    end: vi.fn(),
  }
  return new Promise<{
    status: number
    headers: typeof headers
    body: string
    next: boolean
    error?: unknown
  }>((done) => {
    response.end.mockImplementation((content?: Buffer) => {
      done({ status: response.statusCode, headers, body: content?.toString() ?? "", next: false })
    })
    middleware({ url, method } as IncomingMessage, response as unknown as ServerResponse, (error) =>
      done({ status: response.statusCode, headers, body: "", next: true, error })
    )
  })
}

describe("watched admin dev assets", () => {
  it("serves changed contents and new hashed filenames without a server restart or cached manifest", async () => {
    const file = join(directory, "index-old.js")
    await writeFile(file, "export const old = true")
    expect(await request("/admin/assets/index-old.js")).toMatchObject({
      status: 200,
      body: "export const old = true",
      headers: {
        "content-type": "text/javascript; charset=utf-8",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    })
    await rm(file)
    expect((await request("/admin/assets/index-old.js")).status).toBe(404)
    await writeFile(file, "export const replaced = true")
    expect((await request("/admin/assets/index-old.js")).body).toBe("export const replaced = true")
    await writeFile(join(directory, "index-new.css"), ".ready { color: green }")
    expect(await request("/admin/assets/index-new.css?v=2")).toMatchObject({
      status: 200,
      body: ".ready { color: green }",
      headers: { "content-type": "text/css; charset=utf-8" },
    })
  })
  it("answers HEAD with the same asset headers and no body", async () => {
    await writeFile(join(directory, "index.js"), "console.log('ready')")
    const get = await request("/admin/assets/index.js")
    const head = await request("/admin/assets/index.js", "HEAD")
    expect(head).toMatchObject({ status: 200, headers: get.headers, body: "" })
  })
  it("returns missing assets as404 instead of forwarding to stale Cloudflare manifests", async () => {
    for (const method of ["GET", "HEAD"])
      expect(await request("/admin/assets/missing.js", method)).toMatchObject({
        status: 404,
        next: false,
        body: "",
      })
    await mkdir(join(directory, "folder"))
    expect((await request("/admin/assets/folder")).status).toBe(404)
  })
  it.each([
    "../private.js",
    "%2e%2e/private.js",
    "%2e%2e%2fprivate.js",
    "%2fprivate.js",
    "..%5cprivate.js",
    "%00.js",
  ])("refuses traversal and malformed paths: %s", async (filename) => {
    await writeFile(join(root, "private.js"), "secret")
    expect(await request(`/admin/assets/${filename}`)).toMatchObject({
      status: 403,
      next: false,
      body: "",
    })
  })
  it("rejects malformed URL encoding and links outside generated assets", async () => {
    expect((await request("/admin/assets/%zz.js")).status).toBe(400)
    await writeFile(join(root, "private.js"), "secret")
    await symlink(join(root, "private.js"), join(directory, "link.js"))
    expect(await request("/admin/assets/link.js")).toMatchObject({ status: 403, body: "" })
  })
  it.each([
    ["/admin", "GET"],
    ["/admin/posts", "GET"],
    ["/api/admin/posts", "GET"],
    ["/writing", "GET"],
    ["/admin/assets/index.js", "POST"],
  ])("leaves authentication/page/API handling unchanged for %s %s", async (url, method) => {
    expect(await request(url, method)).toMatchObject({ next: true, headers: {} })
  })
  it("registers only as a dev hook before Cloudflare and never contributes production runtime code", () => {
    const plugin = adminDevAssets()
    expect(plugin.apply).toBe("serve")
    expect(plugin.enforce).toBe("pre")
    expect(plugin).not.toHaveProperty("configurePreviewServer")
    expect(plugin).not.toHaveProperty("transform")
  })
})
