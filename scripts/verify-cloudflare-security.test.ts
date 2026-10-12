import { expect, it, vi } from "vitest"
import { isAccessRedirect, verifyCloudflareSecurity } from "./verify-cloudflare-security.mjs"

it.each([
  [302, "https://cool-star-7099.cloudflareaccess.com/cdn-cgi/access/login/dev.indrax.uk", true],
  [200, "https://cool-star-7099.cloudflareaccess.com/cdn-cgi/access/login/dev.indrax.uk", false],
  [302, "https://evil.test/cdn-cgi/access/login/dev.indrax.uk", false],
  [302, "https://cool-star-7099.cloudflareaccess.com.evil.test/cdn-cgi/access/login/", false],
  [302, "https://cool-star-7099.cloudflareaccess.com/", false],
  [302, "/admin/login", false],
])("identifies actual Access denial: %s %s", (status, location, expected) => {
  expect(isAccessRedirect(new Response(null, { status, headers: { location } }))).toBe(expected)
})

it("fails when a dev API or static/media URL bypasses Access", async () => {
  const fetcher = vi.fn().mockResolvedValue(
    new Response(null, {
      status: 302,
      headers: {
        location: "https://cool-star-7099.cloudflareaccess.com/cdn-cgi/access/login/dev.indrax.uk",
      },
    })
  )
  fetcher.mockResolvedValueOnce(new Response(null, { status: 200 }))
  await expect(verifyCloudflareSecurity("dev", fetcher)).rejects.toThrow("Access is not denying")
})

it.each(["site-app", "media-app", null])(
  "checks the cover media shares the site's Access audience: %s",
  async (mediaAudience) => {
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
      const host = new URL(url).hostname
      const location = new URL(
        `https://cool-star-7099.cloudflareaccess.com/cdn-cgi/access/login/${host}`
      )
      const audience = host === "dev-media.indrax.uk" ? mediaAudience : "site-app"
      if (audience) location.searchParams.set("kid", audience)
      return new Response(null, { status: 302, headers: { location: location.href } })
    })
    if (mediaAudience === "site-app") {
      await expect(verifyCloudflareSecurity("dev", fetcher)).resolves.toBeUndefined()
      expect(fetcher).toHaveBeenCalledTimes(6)
    } else
      await expect(verifyCloudflareSecurity("dev", fetcher)).rejects.toThrow(
        "must share one Access application"
      )
  }
)
