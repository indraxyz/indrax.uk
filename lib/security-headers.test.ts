import { expect, it } from "vitest"
import { applySecurityHeaders, contentSecurityPolicy, createCspNonce } from "./security-headers"
import { THEME_INIT_SCRIPT_HASH } from "./theme"

const directive = (policy: string, name: string) =>
  policy
    .split("; ")
    .find((entry) => entry.startsWith(`${name} `))
    ?.slice(name.length + 1)
    .split(" ")

it("production scripts need this origin, the theme hash or the response nonce", () => {
  const policy = contentSecurityPolicy({ nonce: "abc123", strictScripts: true })
  const scripts = directive(policy, "script-src")!
  expect(scripts).toEqual(
    expect.arrayContaining([
      "'self'",
      "'wasm-unsafe-eval'",
      `'${THEME_INIT_SCRIPT_HASH}'`,
      "'nonce-abc123'",
    ])
  )
  expect(scripts).not.toContain("'unsafe-inline'")
  expect(scripts).not.toContain("'unsafe-eval'")
  expect(scripts).not.toContain("*")
  expect(directive(policy, "default-src")).toEqual(["'self'"])
  expect(directive(policy, "connect-src")).toEqual(["'self'", "data:"])
  expect(directive(policy, "frame-ancestors")).toEqual(["'none'"])
  expect(directive(policy, "object-src")).toEqual(["'none'"])
})

it("omits the nonce source when no document nonce exists", () => {
  const scripts = directive(contentSecurityPolicy({ strictScripts: true }), "script-src")!
  expect(scripts.some((source) => source.startsWith("'nonce-"))).toBe(false)
})

it("keeps scripts open only for Vite's development server", () => {
  const scripts = directive(contentSecurityPolicy({ strictScripts: false }), "script-src")!
  expect(scripts).toContain("'unsafe-inline'")
})

it("mints a fresh 128-bit nonce each time", () => {
  const nonces = new Set(Array.from({ length: 50 }, createCspNonce))
  expect(nonces.size).toBe(50)
  for (const nonce of nonces) expect(atob(nonce)).toHaveLength(16)
})

it("keeps a document's own nonce policy and fills in the default elsewhere", () => {
  const documentPolicy = contentSecurityPolicy({ nonce: "doc", strictScripts: true })
  const page = applySecurityHeaders(
    new Response("", { headers: { "Content-Security-Policy": documentPolicy } }),
    "/",
    { strictScripts: true, noindex: false }
  )
  expect(page.headers.get("Content-Security-Policy")).toBe(documentPolicy)
  const api = applySecurityHeaders(new Response("{}"), "/api/admin/session", {
    strictScripts: true,
    noindex: false,
  })
  expect(api.headers.get("Content-Security-Policy")).toBe(
    contentSecurityPolicy({ strictScripts: true })
  )
  expect(api.headers.get("X-Frame-Options")).toBe("DENY")
  expect(api.headers.get("X-Content-Type-Options")).toBe("nosniff")
})

it.each([
  ["/", false, null],
  ["/admin/login", false, "noindex, nofollow"],
  ["/", true, "noindex, nofollow"],
  ["/writing", true, "noindex, nofollow"],
])("sets X-Robots-Tag for %s (non-production: %s)", (path, noindex, expected) => {
  const result = applySecurityHeaders(new Response(""), path, { strictScripts: true, noindex })
  expect(result.headers.get("X-Robots-Tag")).toBe(expected)
})

it("allows browser-owned image previews only for admin responses", () => {
  for (const path of ["/admin", "/admin/posts/new", "/writing"]) {
    const response = applySecurityHeaders(new Response(""), path, {
      strictScripts: true,
      noindex: false,
    })
    const images = directive(response.headers.get("Content-Security-Policy")!, "img-src")!
    expect(images.includes("blob:")).toBe(path.startsWith("/admin"))
    expect(directive(response.headers.get("Content-Security-Policy")!, "script-src")).not.toContain(
      "blob:"
    )
  }
})
