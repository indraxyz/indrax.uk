import { GET as rss } from "./rss.server"
import {
  getPublishedSlugs,
  getSeriesSlugs,
  getPostBySlug,
} from "@/features/writing/data/queries.server"
import { absoluteUrl, SITE_URL } from "@/config/site"
import { RESUME_CONFIG } from "@/features/resume/config"
import { logServerError } from "./observability"
import { cachedResponse, OG_CACHE_PATH } from "./cache-response.server"

const xmlEscape = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
async function sitemap() {
  const [posts, series] = await Promise.all([getPublishedSlugs(), getSeriesSlugs()])
  const pages = ["/", "/resume", "/tech-stack"].map((path) => ({
    url: absoluteUrl(path),
    date: RESUME_CONFIG.updatedAt,
    frequency: "monthly",
    priority: path === "/" ? 1 : path === "/resume" ? 0.9 : 0.7,
  }))
  if (posts.length) {
    pages.push({
      url: absoluteUrl("/writing"),
      date: posts[0].updatedAt,
      frequency: "weekly",
      priority: 0.8,
    })
    pages.push(
      ...posts.map((post) => ({
        url: absoluteUrl(`/writing/${post.slug}`),
        date: post.updatedAt,
        frequency: "monthly",
        priority: 0.7,
      }))
    )
    pages.push(
      ...series.map((entry) => ({
        url: absoluteUrl(`/writing/series/${entry.slug}`),
        date: entry.updatedAt,
        frequency: "weekly",
        priority: 0.5,
      }))
    )
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${pages.map((page) => `<url><loc>${xmlEscape(page.url)}</loc>${page.date ? `<lastmod>${new Date(page.date).toISOString()}</lastmod>` : ""}<changefreq>${page.frequency}</changefreq><priority>${page.priority}</priority></url>`).join("")}</urlset>`
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600",
    },
  })
}
export async function handleResources(request: Request): Promise<Response> {
  const path = new URL(request.url).pathname
  if (path === "/api/upload") {
    if (request.method !== "POST")
      return new Response("Method not allowed", { status: 405, headers: { Allow: "POST" } })
    const { POST } = await import("./upload.server")
    return POST(request)
  }
  if (!["GET", "HEAD"].includes(request.method))
    return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD" } })
  let response: Response
  if (path === "/robots.txt")
    response = new Response(
      `User-Agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nSitemap: ${SITE_URL}/sitemap.xml\n`,
      { headers: { "Content-Type": "text/plain; charset=utf-8" } }
    )
  else if (path === "/sitemap.xml") response = await sitemap()
  else if (path === "/writing/rss.xml") response = await rss()
  else if (path.startsWith("/api/views/")) {
    const { GET } = await import("./views.server")
    response = await GET(request, {
      params: Promise.resolve({ slug: decodeURIComponent(path.slice("/api/views/".length)) }),
    })
  } else if (path.endsWith("/opengraph-image")) {
    const match = /^\/writing\/([a-z0-9]+(?:-[a-z0-9]+)*)\/opengraph-image$/.exec(path)
    const generic = [
      "/opengraph-image",
      "/resume/opengraph-image",
      "/tech-stack/opengraph-image",
      "/writing/opengraph-image",
    ].includes(path)
    if (!generic && (!match || match[1].length > 120))
      return new Response("Not found", { status: 404 })
    try {
      const key = new URL(OG_CACHE_PATH, request.url)
      key.searchParams.set("card", path)
      key.searchParams.set(
        "build",
        process.env.APP_BUILD_ID ?? RESUME_CONFIG.updatedAt ?? "development"
      )
      if (match) {
        // Resolve current public revision before cache lookup, including unpublishing.
        const post = await getPostBySlug(match[1])
        if (!post) return Response.redirect(new URL("/opengraph-image", request.url), 302)
        key.searchParams.set("revision", post.updatedAt)
        key.searchParams.set("id", post.id)
        response = await cachedResponse(new Request(key), async () => {
          const { renderPostCard } = await import("@/features/writing/social-card")
          return renderPostCard(post)
        })
      } else {
        response = await cachedResponse(new Request(key), async () => {
          const { renderSocialCard } = await import("@/features/resume/social-card")
          return renderSocialCard()
        })
      }
    } catch (error) {
      logServerError(error, { scope: "resource.opengraph", path })
      return new Response("Image unavailable", { status: 503 })
    }
  } else response = new Response("Not found", { status: 404 })
  return request.method === "HEAD"
    ? new Response(null, { status: response.status, headers: response.headers })
    : response
}
