import { expect, it, vi } from "vitest"
import { invokePreviewCleanup, verifyMaintenanceRevision } from "./preview-maintenance.mjs"

const origin = "https://develop.previews.indrax.uk"
const token = "fixture-only-".repeat(4)
const success = () => Response.json({ ok: true }, { headers: { "cache-control": "no-store" } })

it("sends the machine credential only to the exact staging origin without redirects", async () => {
  const fetcher = vi.fn().mockResolvedValue(success())
  await invokePreviewCleanup({ origin, token, fetcher })
  expect(fetcher).toHaveBeenCalledWith(
    `${origin}/api/internal/preview/media-cleanup`,
    expect.objectContaining({
      method: "POST",
      redirect: "manual",
      credentials: "omit",
      body: "{}",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      signal: expect.any(AbortSignal),
    })
  )
})

it.each([
  "https://indrax.uk",
  "http://develop.previews.indrax.uk",
  `${origin}/`,
  "https://evil.test",
])("refuses credential delivery to %s", async (origin) => {
  const fetcher = vi.fn()
  await expect(invokePreviewCleanup({ origin, token, fetcher })).rejects.toThrow("origin")
  expect(fetcher).not.toHaveBeenCalled()
})

it.each(["", "short", "x".repeat(513), `${token}\n`])("rejects invalid tokens", async (token) => {
  const fetcher = vi.fn()
  await expect(invokePreviewCleanup({ origin, token, fetcher })).rejects.toThrow("token")
  expect(fetcher).not.toHaveBeenCalled()
})

it.each([301, 302, 401, 404, 500, 503])("fails without retry on HTTP %s", async (status) => {
  const fetcher = vi.fn().mockResolvedValue(new Response(null, { status }))
  await expect(invokePreviewCleanup({ origin, token, fetcher })).rejects.toThrow(`HTTP ${status}`)
  expect(fetcher).toHaveBeenCalledOnce()
})

it("does not disclose a credential-bearing transport exception", async () => {
  const fetcher = vi.fn().mockRejectedValue(new Error(`failed ${token}`))
  await expect(invokePreviewCleanup({ origin, token, fetcher })).rejects.toThrow(
    "inspect tracked work"
  )
})

const sha = "a".repeat(40)
function github({ head = sha, deploymentSha = sha, state = "success", url = origin } = {}) {
  return vi
    .fn()
    .mockResolvedValueOnce(Response.json({ object: { sha: head } }))
    .mockResolvedValueOnce(Response.json([{ id: 42, sha: deploymentSha }]))
    .mockResolvedValueOnce(Response.json([{ state, environment_url: url }]))
}
const preflight = { repository: "indraxyz/indrax.uk", sha, githubToken: "test-token" }

it("requires the current develop head and the latest completed successful Preview deployment", async () => {
  await expect(
    verifyMaintenanceRevision({ ...preflight, fetcher: github() })
  ).resolves.toBeUndefined()
})

it.each([
  { head: "b".repeat(40) },
  { deploymentSha: "b".repeat(40) },
  { state: "failure" },
  { state: "inactive" },
  { url: "https://dev.indrax.uk" },
])("refuses stale, failed or legacy deployment evidence: %j", async (settings) => {
  await expect(
    verifyMaintenanceRevision({ ...preflight, fetcher: github(settings) })
  ).rejects.toThrow()
})

it("rejects a newer unfinished deployment even when an older deployment succeeded", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ object: { sha } }))
    .mockResolvedValueOnce(
      Response.json([
        { id: 43, sha },
        { id: 42, sha },
      ])
    )
    .mockResolvedValueOnce(Response.json([{ state: "in_progress" }]))
    .mockResolvedValueOnce(Response.json([{ state: "success", environment_url: origin }]))
  await expect(verifyMaintenanceRevision({ ...preflight, fetcher })).rejects.toThrow(
    "not successful"
  )
})
