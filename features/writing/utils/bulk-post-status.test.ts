import { HTTPError } from "ky"
import { expect, it, vi } from "vitest"
import { runBulkPostStatus } from "./bulk-post-status"

it.each(["published", "draft", "archived"] as const)(
  "runs ordered unique %s writes and acknowledges successes",
  async (status) => {
    const change = vi.fn().mockResolvedValue({ ok: true, postId: "a" })
    const acknowledge = vi.fn()
    const result = await runBulkPostStatus({
      ids: ["a", "a", "b"],
      status,
      change,
      acknowledge,
      isActive: () => true,
    })
    expect(change.mock.calls).toEqual([
      ["a", status],
      ["b", status],
    ])
    expect(acknowledge).toHaveBeenCalledTimes(2)
    expect(result).toMatchObject({
      succeeded: ["a", "b"],
      failed: [],
      notAttempted: [],
      stopped: false,
    })
  }
)

it("continues partial validation/transport failures without automatic retry", async () => {
  const change = vi
    .fn()
    .mockResolvedValueOnce({ ok: false, message: "No content" })
    .mockRejectedValueOnce(new Error("network"))
    .mockResolvedValueOnce({ ok: true })
  const acknowledge = vi.fn()
  const result = await runBulkPostStatus({
    ids: ["a", "b", "c"],
    status: "published",
    change,
    acknowledge,
    isActive: () => true,
  })
  expect(change).toHaveBeenCalledTimes(3)
  expect(result.succeeded).toEqual(["c"])
  expect(result.failed.map(({ id }) => id)).toEqual(["a", "b"])
  expect(result.failed[0].message).toBe("No content")
  expect(acknowledge).toHaveBeenCalledTimes(1)
})

it.each([401, 403])("stops subsequent writes on HTTP %s", async (status) => {
  const error = new HTTPError(
    new Response(null, { status }),
    new Request("https://example.test/api/admin"),
    {} as never
  )
  const change = vi.fn().mockRejectedValue(error)
  const result = await runBulkPostStatus({
    ids: ["a", "b"],
    status: "archived",
    change,
    acknowledge: vi.fn(),
    isActive: () => true,
  })
  expect(change).toHaveBeenCalledTimes(1)
  expect(result).toMatchObject({ stopped: true, notAttempted: ["b"] })
})

it("stops after the in-flight response when the archive unmounts", async () => {
  let active = true
  const change = vi.fn().mockImplementation(async () => {
    active = false
    return { ok: true }
  })
  const result = await runBulkPostStatus({
    ids: ["a", "b"],
    status: "draft",
    change,
    acknowledge: vi.fn(),
    isActive: () => active,
  })
  expect(change).toHaveBeenCalledTimes(1)
  expect(result).toMatchObject({ succeeded: ["a"], stopped: true, notAttempted: ["b"] })
})
