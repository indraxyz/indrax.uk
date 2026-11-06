import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, expect, it } from "vitest"
import { writeAssetIndexingHeaders } from "./asset-indexing.mjs"

let directory: string
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "indrax-asset-indexing-"))
})
afterEach(async () => {
  await rm(directory, { recursive: true, force: true })
})

it.each(["staging", "dev"])(
  "covers static responses in %s without changing cache policy",
  async (target) => {
    await writeAssetIndexingHeaders(directory, target)
    const headers = await readFile(join(directory, "_headers"), "utf8")
    expect(headers).toContain("/*\n  X-Robots-Tag: noindex, nofollow\n")
    expect(headers).not.toContain("Cache-Control")
    await writeAssetIndexingHeaders(directory, target)
    expect(await readFile(join(directory, "_headers"), "utf8")).toBe(headers)
  }
)

it("removes a stale staging block on production rebuild and preserves authored rules verbatim", async () => {
  const authored = "# Custom asset policy\n/fonts/*\n  X-Content-Type-Options: nosniff\n"
  await writeFile(join(directory, "_headers"), authored)
  await writeAssetIndexingHeaders(directory, "staging")
  await writeAssetIndexingHeaders(directory, "production")
  expect(await readFile(join(directory, "_headers"), "utf8")).toBe(authored)
})

it("leaves production without a generated file and removes generated-only stale content", async () => {
  await writeAssetIndexingHeaders(directory, "production")
  await expect(readFile(join(directory, "_headers"), "utf8")).rejects.toMatchObject({
    code: "ENOENT",
  })
  await writeAssetIndexingHeaders(directory, "staging")
  await writeAssetIndexingHeaders(directory, "production")
  await expect(readFile(join(directory, "_headers"), "utf8")).rejects.toMatchObject({
    code: "ENOENT",
  })
})
