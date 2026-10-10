import { runWithRequest } from "../lib/runtime.server"
import { applySecurityHeaders } from "../lib/security-headers"

type WorkerEnv = CloudflareEnv
let publicRuntime:
  | Promise<{
      handler: ReturnType<(typeof import("react-router"))["createRequestHandler"]>
      Context: (typeof import("react-router"))["RouterContextProvider"]
    }>
  | undefined
function getPublicRuntime() {
  return (publicRuntime ??= import("react-router").then(
    ({ createRequestHandler, RouterContextProvider }) => ({
      handler: createRequestHandler(
        () => import("virtual:react-router/server-build"),
        import.meta.env.MODE
      ),
      Context: RouterContextProvider,
    })
  ))
}
const SESSION_COOKIE = /(?:^|;\s*)(?:__Secure-)?better-auth\.session_token=/
export default {
  async fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext): Promise<Response> {
    return runWithRequest(
      request,
      { ...env, NODE_ENV: import.meta.env.PROD ? "production" : "development" },
      ctx,
      async () => {
        const url = new URL(request.url)
        const path = url.pathname
        let response: Response
        if (path === "/blog" || path.startsWith("/blog/") || path === "/rss.xml") {
          const target = new URL(request.url)
          if (path === "/rss.xml") target.pathname = "/writing/rss.xml"
          else if (path === "/blog/search") target.pathname = "/writing"
          else if (path.startsWith("/blog/tag/")) {
            target.pathname = "/writing"
            let tag = path.slice("/blog/tag/".length)
            try {
              tag = decodeURIComponent(tag)
            } catch {
              // Retain malformed input safely as query text; archive validation owns it.
            }
            if (!target.searchParams.getAll("tag").includes(tag))
              target.searchParams.append("tag", tag)
          } else target.pathname = path.replace(/^\/blog/, "/writing")
          response = Response.redirect(target, 308)
        } else if (path.startsWith("/api/auth/")) {
          const { getAuth } = await import("../lib/auth.server")
          const auth = getAuth()
          response = auth
            ? await auth.handler(request)
            : Response.json({ error: "Authentication is not configured." }, { status: 503 })
        } else if (path.startsWith("/api/writing/") || path.startsWith("/api/admin/")) {
          const { handleWritingApi } = await import("../features/writing/api/server")
          response = (await handleWritingApi(request)) ?? new Response("Not found", { status: 404 })
        } else if (
          path === "/api/upload" ||
          path.startsWith("/api/views/") ||
          path.endsWith("/opengraph-image") ||
          ["/opengraph-image", "/robots.txt", "/sitemap.xml", "/writing/rss.xml"].includes(path)
        ) {
          const { handleResources } = await import("../lib/resources.server")
          response = await handleResources(request)
        } else if (path.startsWith("/admin/assets/")) {
          response = await env.ASSETS.fetch(request)
        } else if (path === "/admin" || path.startsWith("/admin/")) {
          if (
            path !== "/admin/login" &&
            !SESSION_COOKIE.test(request.headers.get("cookie") ?? "")
          ) {
            response = Response.redirect(new URL("/admin/login", url), 302)
          } else {
            response = await env.ASSETS.fetch(
              new Request(new URL("/admin/index.html", url), { method: request.method })
            )
            response = new Response(response.body, {
              status: response.status,
              headers: response.headers,
            })
            response.headers.set("Cache-Control", "no-store")
          }
        } else {
          const { handler, Context } = await getPublicRuntime()
          response = await handler(request, new Context())
        }
        return applySecurityHeaders(response, path)
      }
    )
  },
} satisfies ExportedHandler<WorkerEnv>
