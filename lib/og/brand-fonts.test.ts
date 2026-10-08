import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, beforeEach, expect, it, vi } from "vitest"

let directory: string
beforeEach(async () => {
  vi.resetModules()
  directory = await mkdtemp(join(tmpdir(), "indrax-font-tests-"))
  vi.spyOn(process, "cwd").mockReturnValue(directory)
})
afterEach(async () => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  await rm(directory, { recursive: true, force: true })
})

it("shares concurrent disk reads and retains font bytes for subsequent cards", async () => {
  const fonts = join(directory, "public", "fonts")
  await mkdir(fonts, { recursive: true })
  for (const name of ["JetBrainsMono-Regular.ttf", "JetBrainsMono-ExtraBold.ttf"]) {
    await writeFile(join(fonts, name), new Uint8Array([1, 2, 3]))
  }
  const fetch = vi.fn()
  vi.stubGlobal("fetch", fetch)
  const { loadBrandFonts } = await import("./brand-fonts")
  const [first, concurrent] = await Promise.all([loadBrandFonts(), loadBrandFonts()])
  expect(concurrent).toBe(first)
  // Remove the files: a subsequent card must reuse loaded bytes without I/O.
  await rm(fonts, { recursive: true })
  expect(await loadBrandFonts()).toBe(first)
  expect(fetch).not.toHaveBeenCalled()
  expect(Array.from(new Uint8Array(first.regular))).toEqual([1, 2, 3])
})

it("fetches each font once when the Worker has no filesystem", async () => {
  const fetch = vi.fn(async () => new Response(new Uint8Array([4, 5])))
  vi.stubGlobal("fetch", fetch)
  const { loadBrandFonts } = await import("./brand-fonts")
  const [first, concurrent] = await Promise.all([loadBrandFonts(), loadBrandFonts()])
  expect(concurrent).toBe(first)
  await loadBrandFonts()
  expect(fetch).toHaveBeenCalledTimes(2)
  expect(new Uint8Array(first.extraBold)).toEqual(new Uint8Array([4, 5]))
})

it("retries after a transient font failure instead of caching a rejected promise", async () => {
  const fetch = vi.fn(async () => new Response(null, { status: 503 }))
  vi.stubGlobal("fetch", fetch)
  const { loadBrandFonts } = await import("./brand-fonts")
  await expect(loadBrandFonts()).rejects.toThrow("Could not fetch")
  // The second parallel file read can complete after the first failed request.
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
  fetch.mockImplementation(async () => new Response(new Uint8Array([6])))
  expect(await loadBrandFonts()).toMatchObject({ regular: expect.any(ArrayBuffer) })
  expect(fetch).toHaveBeenCalledTimes(4)
})
