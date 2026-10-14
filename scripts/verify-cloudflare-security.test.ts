import { expect, it, vi } from "vitest"
import { verifyCloudflareSecurity } from "./verify-cloudflare-security.mjs"

const policy = "default-src 'self'; script-src 'self' 'nonce-test' 'wasm-unsafe-eval';"
const privateHeaders = { "content-type": "application/json", "cache-control": "no-store" }

function responses(overrides: Record<string, () => Response> = {}) {
  return vi.fn<typeof fetch>(async (input) => {
    const url = new URL(
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url
    )
    const override = overrides[url.pathname]
    if (override) return override()
    if (url.pathname === "/" || url.pathname === "/admin/login")
      return new Response("public page", {
        headers: { "content-security-policy": policy, "x-robots-tag": "noindex, nofollow" },
      })
    if (url.pathname === "/robots.txt") return new Response("User-agent: *\nDisallow: /\n")
    if (url.pathname === "/admin")
      return new Response(null, { status: 302, headers: { location: `${url.origin}/admin/login` } })
    if (url.pathname === "/api/admin/session")
      return Response.json({ author: null, authConfigured: true }, { headers: privateHeaders })
    if (url.pathname.startsWith("/api/"))
      return Response.json({ error: "Not authorised." }, { status: 401, headers: privateHeaders })
    if (url.pathname === "/covers/security-smoke.png")
      return new Response(null, {
        status: 404,
        headers: {
          "x-content-type-options": "nosniff",
          "content-security-policy": "default-src 'none'; sandbox",
        },
      })
    throw new Error(`Unexpected request: ${url.pathname}`)
  })
}

it.each(["dev", "production"])(
  "verifies public pages and private admin boundaries in %s",
  async (target) => {
    const fetcher = responses()
    await expect(verifyCloudflareSecurity(target, fetcher)).resolves.toBeUndefined()
    const origin = target === "dev" ? "https://dev.indrax.uk" : "https://indrax.uk"
    const media = target === "dev" ? "https://dev-media.indrax.uk" : "https://media.indrax.uk"
    expect(fetcher).toHaveBeenCalledWith(`${media}/covers/security-smoke.png`, expect.anything())
    expect(fetcher).toHaveBeenCalledWith(
      `${origin}/api/upload?purpose=cover`,
      expect.objectContaining({
        method: "POST",
        body: "",
        headers: { origin, "content-type": "image/png" },
      })
    )
    for (const [, options] of fetcher.mock.calls) {
      expect(options).toEqual(
        expect.objectContaining({
          redirect: "manual",
          credentials: "omit",
          signal: expect.any(AbortSignal),
        })
      )
    }
  }
)

it.each(["dev", "production"])(
  "rejects invalid public/admin/media boundaries in %s",
  async (target) => {
    const failures: [string, () => Response, string][] = [
      [
        "/",
        () =>
          new Response(null, {
            status: 302,
            headers: { location: "https://team.cloudflareaccess.com/login" },
          }),
        "publicly reachable",
      ],
      [
        "/admin/login",
        () =>
          new Response(null, {
            headers: { "content-security-policy": "script-src 'self' 'unsafe-inline'" },
          }),
        "strict script policy",
      ],
      ["/", () => new Response(null), "strict script policy"],
      [
        "/admin/login",
        () => new Response(null, { headers: { "content-security-policy": policy } }),
        "noindex",
      ],
      [
        "/admin",
        () =>
          new Response(null, {
            status: 302,
            headers: { location: "https://other.test/admin/login" },
          }),
        "app login",
      ],
      ["/admin", () => new Response("private admin"), "app login"],
      [
        "/api/admin/session",
        () => Response.json({ author: null, authConfigured: true }),
        "uncached JSON",
      ],
      [
        "/api/admin/session",
        () =>
          Response.json(
            { author: { id: "author" }, authConfigured: true },
            { headers: privateHeaders }
          ),
        "private session data",
      ],
      [
        "/api/admin/session",
        () => Response.json({ author: null, authConfigured: false }, { headers: privateHeaders }),
        "configured GitHub",
      ],
      [
        "/api/admin/session",
        () =>
          Response.json(
            { author: null, authConfigured: true, databaseConfigured: true },
            { headers: privateHeaders }
          ),
        "private session data",
      ],
      [
        "/api/admin/posts/archive",
        () => Response.json({ posts: [] }, { headers: privateHeaders }),
        "signed-out reads",
      ],
      ["/api/admin/tags", () => Response.json({}, { status: 401 }), "uncached JSON"],
      ["/api/admin/overview", () => new Response(null, { status: 302 }), "signed-out reads"],
      [
        "/api/upload",
        () => Response.json({ publicUrl: "https://media.test/cover.png" }),
        "signed-out uploads",
      ],
      ["/covers/security-smoke.png", () => new Response(null, { status: 302 }), "public 404"],
      ["/covers/security-smoke.png", () => new Response(null, { status: 404 }), "safety headers"],
    ]
    for (const [path, response, message] of failures)
      await expect(
        verifyCloudflareSecurity(target, responses({ [path]: response })),
        path
      ).rejects.toThrow(message)
  }
)

it("requires a non-indexable public dev site", async () => {
  await expect(
    verifyCloudflareSecurity(
      "dev",
      responses({
        "/": () => new Response(null, { headers: { "content-security-policy": policy } }),
      })
    )
  ).rejects.toThrow("noindex")
  await expect(
    verifyCloudflareSecurity(
      "dev",
      responses({
        "/robots.txt": () => new Response("User-agent: *\nAllow: /\n"),
      })
    )
  ).rejects.toThrow("disallow indexing")
})

it("rejects unknown deployment targets before making a request", async () => {
  const fetcher = responses()
  await expect(verifyCloudflareSecurity("other", fetcher)).rejects.toThrow(
    "Choose dev or production"
  )
  expect(fetcher).not.toHaveBeenCalled()
})
