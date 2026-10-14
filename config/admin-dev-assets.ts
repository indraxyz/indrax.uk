import { readFile, realpath, stat } from "node:fs/promises"
import { extname, isAbsolute, relative, resolve, sep } from "node:path"
import type { Connect, Plugin } from "vite"

const PREFIX = "/admin/assets/"
const CONTENT_TYPES: Record<string, string> = {
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
}

function inside(directory: string, file: string): boolean {
  const path = relative(directory, file)
  return path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path)
}

/** The independent watched admin build changes filenames after Workers snapshots its
 * development asset manifest. Read generated assets fresh from disk for local GET/HEAD
 * requests; admin HTML, APIs and their authentication still reach the Worker.
 */
export function createAdminDevAssetsMiddleware(directory: string): Connect.NextHandleFunction {
  return (request, response, next) => {
    const path = request.url?.split("?")[0] ?? ""
    if (!path.startsWith(PREFIX) || !["GET", "HEAD"].includes(request.method ?? "")) {
      next()
      return
    }
    response.setHeader("Cache-Control", "no-store")
    response.setHeader("X-Content-Type-Options", "nosniff")
    let filename: string
    try {
      filename = decodeURIComponent(path.slice(PREFIX.length))
    } catch {
      response.statusCode = 400
      response.end()
      return
    }
    if (
      !filename ||
      filename.includes("\\") ||
      filename.includes("\0") ||
      filename.split("/").some((part) => part === ".." || part === "." || part === "")
    ) {
      response.statusCode = 403
      response.end()
      return
    }
    const candidate = resolve(directory, filename)
    if (!inside(directory, candidate)) {
      response.statusCode = 403
      response.end()
      return
    }
    void (async () => {
      try {
        const [root, file] = await Promise.all([realpath(directory), realpath(candidate)])
        if (!inside(root, file)) {
          response.statusCode = 403
          response.end()
          return
        }
        const details = await stat(file)
        if (!details.isFile()) {
          response.statusCode = 404
          response.end()
          return
        }
        const content = request.method === "HEAD" ? undefined : await readFile(file)
        response.setHeader(
          "Content-Type",
          CONTENT_TYPES[extname(file).toLowerCase()] ?? "application/octet-stream"
        )
        response.setHeader("Content-Length", content?.byteLength ?? details.size)
        response.statusCode = 200
        response.end(content)
      } catch (error) {
        if (["ENOENT", "ENOTDIR"].includes((error as NodeJS.ErrnoException).code ?? "")) {
          response.statusCode = 404
          response.end()
        } else next(error)
      }
    })()
  }
}

/** Vite's configureServer hook installs this before Cloudflare's dev middleware.
 * apply:serve excludes production builds and preview servers entirely.
 */
export function adminDevAssets(): Plugin {
  return {
    name: "indrax-admin-dev-assets",
    apply: "serve",
    enforce: "pre",
    configureServer(server) {
      if (server.config.publicDir)
        server.middlewares.use(
          createAdminDevAssetsMiddleware(resolve(server.config.publicDir, "admin/assets"))
        )
    },
  }
}
