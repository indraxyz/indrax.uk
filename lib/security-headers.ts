import { THEME_INIT_SCRIPT_HASH } from "./theme"

interface CspOptions {
  /** Per-response nonce for React Router's inline hydration scripts. */
  nonce?: string
  /** Browser-owned image previews in the admin editor only. */
  allowImagePreviews?: boolean
  /**
   * Production builds only. Vite's dev server injects inline and eval'd modules
   * for hot reload, so development keeps scripts open; the browser suite runs
   * the built Worker and exercises the strict policy.
   */
  strictScripts: boolean
}

/**
 * The Content-Security-Policy for every Worker response (threat T-12).
 *
 * Scripts run only from this origin, as the hashed theme initializer, or carrying
 * this response's nonce. No `unsafe-inline`, no `unsafe-eval` (wasm compilation
 * alone is allowed, for the PDF renderer): an injected
 * `<script>` or `onerror=` has nothing to match, so a sanitizer bypass stops at
 * the browser instead of reaching the author's session.
 */
export function contentSecurityPolicy({
  nonce,
  strictScripts,
  allowImagePreviews = false,
}: CspOptions): string {
  const scriptSources = strictScripts
    ? [
        "'self'",
        // The CV's PDF layout engine is WebAssembly. This admits compiling wasm
        // only; JavaScript `eval` and inline script stay blocked.
        "'wasm-unsafe-eval'",
        `'${THEME_INIT_SCRIPT_HASH}'`,
        ...(nonce ? [`'nonce-${nonce}'`] : []),
      ]
    : ["'self'", "'unsafe-inline'", "'unsafe-eval'"]
  return [
    "default-src 'self'",
    `script-src ${scriptSources.join(" ")}`,
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "object-src 'none'",
    "form-action 'self'",
    `img-src 'self' data: https:${allowImagePreviews ? " blob:" : ""}`,
    "font-src 'self'",
    "connect-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "frame-src 'none'",
    "media-src 'self'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "upgrade-insecure-requests",
  ].join("; ")
}

/** 128 random bits, base64 - fresh for every document response. */
export function createCspNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return btoa(String.fromCharCode(...bytes))
}

export function applySecurityHeaders(
  response: Response,
  path: string,
  { strictScripts, noindex }: { strictScripts: boolean; noindex: boolean }
): Response {
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
  // SSR documents arrive with a nonce-bearing policy from `entry.server`; keep it.
  if (!result.headers.has("Content-Security-Policy"))
    result.headers.set(
      "Content-Security-Policy",
      contentSecurityPolicy({
        strictScripts,
        allowImagePreviews: path === "/admin" || path.startsWith("/admin/"),
      })
    )
  if (noindex || path === "/admin" || path.startsWith("/admin/"))
    result.headers.set("X-Robots-Tag", "noindex, nofollow")
  return result
}
