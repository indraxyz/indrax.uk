import { beforeEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ db: {}, getDb: vi.fn(), pending: vi.fn(), detached: vi.fn() }))
vi.mock("./db/index.server", () => ({ getDb: mocks.getDb }))
vi.mock("@/features/writing/data/media-uploads.server", () => ({
  drainPendingUploads: mocks.pending,
}))
vi.mock("./cover-cleanup.server", () => ({ drainCoverCleanup: mocks.detached }))

import { runScheduledMediaCleanup } from "./media-cleanup.server"

beforeEach(() => {
  vi.resetAllMocks()
  mocks.getDb.mockReturnValue(mocks.db)
  mocks.pending.mockResolvedValue(undefined)
  mocks.detached.mockResolvedValue(undefined)
})

it("awaits pending expiry and detached retries without requiring another author mutation", async () => {
  let release!: () => void
  mocks.pending.mockReturnValue(
    new Promise<void>((resolve) => {
      release = resolve
    })
  )
  let completed = false
  const job = runScheduledMediaCleanup().then(() => {
    completed = true
  })
  await Promise.resolve()
  expect(mocks.pending).toHaveBeenCalledWith(mocks.db)
  expect(mocks.detached).not.toHaveBeenCalled()
  expect(completed).toBe(false)
  release()
  await job
  expect(completed).toBe(true)
  expect(mocks.detached).toHaveBeenCalledWith(mocks.db)
})

it("still retries detached images if pending expiry fails", async () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => undefined)
  mocks.pending.mockRejectedValue(new Error("Database unavailable"))
  try {
    await expect(runScheduledMediaCleanup()).rejects.toThrow(
      "Scheduled media cleanup was incomplete"
    )
    expect(mocks.detached).toHaveBeenCalledOnce()
    expect(error).toHaveBeenCalledOnce()
  } finally {
    error.mockRestore()
  }
})

it("does no work without a configured database", async () => {
  mocks.getDb.mockReturnValue(null)
  await runScheduledMediaCleanup()
  expect(mocks.pending).not.toHaveBeenCalled()
  expect(mocks.detached).not.toHaveBeenCalled()
})
