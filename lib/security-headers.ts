import { POSTHOG_ASSET_HOST, POSTHOG_HOST } from "./analytics-host"
const CSP = [
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "object-src 'none'",
  "form-action 'self'",
  "img-src 'self' data: https:",
  "font-src 'self'",
  `connect-src 'self' ${POSTHOG_HOST}${POSTHOG_ASSET_HOST ? ` ${POSTHOG_ASSET_HOST}` : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "frame-src 'none'",
  "media-src 'self'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "upgrade-insecure-requests",
].join("; ")
export function applySecurityHeaders(response: Response, path: string): Response {
  const result = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  })
  result.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
  result.headers.set("X-Content-Type-Options", "nosniff")
  result.headers.set(
    "Referrer-Policy",
    result.headers.get("Referrer-Policy") ?? "strict-origin-when-cross-origin"
  )
  result.headers.set("X-Frame-Options", "DENY")
  result.headers.set("Content-Security-Policy", CSP)
  if (path === "/admin" || path.startsWith("/admin/"))
    result.headers.set("X-Robots-Tag", "noindex, nofollow")
  return result
}
