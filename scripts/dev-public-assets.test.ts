import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { copyPublicAssets, devPublicDirectory } from "./dev-public-assets.mjs"

let root: string
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "indrax-dev-public-test-"))
})
afterEach(() => rm(root, { recursive: true, force: true }))

describe("development public asset roots", () => {
  it("keeps ordinary development in the project public directory", () => {
    expect(devPublicDirectory(undefined, root)).toBe(join(root, "public"))
    expect(devPublicDirectory("", root)).toBe(join(root, "public"))
  })

  it("uses an absolute override consistently for private public and admin assets", () => {
    const directory = join(root, "isolated public")
    expect(devPublicDirectory(directory, "/another-project")).toBe(directory)
    expect(join(devPublicDirectory(directory), "admin")).toBe(join(directory, "admin"))
    expect(() => devPublicDirectory("relative-test-output", root)).toThrow(/absolute path/)
  })

  it("copies public inputs without stale admin output and leaves the source unchanged", async () => {
    const source = join(root, "source")
    const first = join(root, "first")
    const second = join(root, "second")
    await mkdir(join(source, "admin/assets"), { recursive: true })
    await mkdir(join(source, "fonts"), { recursive: true })
    await writeFile(join(source, "admin/index.html"), "ordinary admin")
    await writeFile(join(source, "admin/assets/index.js"), "ordinary bundle")
    await writeFile(join(source, "fonts/font.woff2"), "shared font")
    await writeFile(join(source, "administrator.txt"), "public input")
    await Promise.all([copyPublicAssets(source, first), copyPublicAssets(source, second)])
    for (const directory of [first, second]) {
      await expect(access(join(directory, "admin"))).rejects.toMatchObject({ code: "ENOENT" })
      expect(await readFile(join(directory, "fonts/font.woff2"), "utf8")).toBe("shared font")
      expect(await readFile(join(directory, "administrator.txt"), "utf8")).toBe("public input")
    }
    await mkdir(join(first, "admin/assets"), { recursive: true })
    await writeFile(join(first, "admin/index.html"), "test admin")
    await writeFile(join(first, "admin/assets/index.js"), "test bundle")
    await writeFile(join(first, "fonts/font.woff2"), "test font")
    expect(await readFile(join(source, "admin/index.html"), "utf8")).toBe("ordinary admin")
    expect(await readFile(join(source, "admin/assets/index.js"), "utf8")).toBe("ordinary bundle")
    expect(await readFile(join(source, "fonts/font.woff2"), "utf8")).toBe("shared font")
    expect(await readFile(join(second, "fonts/font.woff2"), "utf8")).toBe("shared font")
  })
})
