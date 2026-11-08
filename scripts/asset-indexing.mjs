import { readFile, writeFile, rm } from "node:fs/promises"
import { join } from "node:path"

const GENERATED_RULE =
  "# BEGIN indrax generated non-production indexing\n/*\n  X-Robots-Tag: noindex, nofollow\n# END indrax generated non-production indexing\n\n"

/** Static assets can bypass the Worker, so non-production builds need an asset rule too.
 * Remove only our exact generated block; preserve all source-authored header rules.
 * @param {string} directory
 * @param {string} target
 */
export async function writeAssetIndexingHeaders(directory, target) {
  const path = join(directory, "_headers")
  let source
  try {
    source = await readFile(path, "utf8")
  } catch (error) {
    if (error.code !== "ENOENT") throw error
    source = ""
  }
  const authored = source.replaceAll(GENERATED_RULE, "")
  const result = target === "staging" ? GENERATED_RULE + authored : authored
  if (result === source) return
  if (result) await writeFile(path, result)
  else await rm(path, { force: true })
}
