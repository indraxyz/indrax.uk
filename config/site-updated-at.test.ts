import { beforeEach, expect, test, vi } from "vitest"

const git = vi.hoisted(() => vi.fn())
vi.mock("node:child_process", () => ({ execFileSync: git }))
import { resolveSiteUpdatedAt } from "./site-updated-at"

beforeEach(() => {
  git.mockReset()
})

test("uses the committed revision date, including a shallow checkout", () => {
  git.mockReturnValue("2026-10-06\n")
  expect(resolveSiteUpdatedAt("")).toBe("2026-10-06")
  expect(git).toHaveBeenCalledWith("git", ["log", "-1", "--format=%cs"], expect.any(Object))
})

test("accepts an explicit date without requiring Git", () => {
  expect(resolveSiteUpdatedAt(" 2024-02-29 ")).toBe("2024-02-29")
  expect(git).not.toHaveBeenCalled()
})

test.each(["2026-02-29", "2026-13-01", "not-a-date", "2026-10-06T00:00:00Z"])(
  "rejects invalid revision metadata: %s",
  (date) => {
    expect(() => resolveSiteUpdatedAt(date)).toThrow("valid calendar date")
  }
)

test("requires explicit metadata in a source archive without Git", () => {
  git.mockImplementation(() => {
    throw new Error("Git unavailable")
  })
  expect(() => resolveSiteUpdatedAt("")).toThrow("Set NEXT_PUBLIC_SITE_UPDATED_AT")
})
