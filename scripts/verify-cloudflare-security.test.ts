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
