import { SITE_URL } from "@/features/resume/config"

export interface BrandFonts {
  regular: ArrayBuffer
  extraBold: ArrayBuffer
}

const FILES = {
  regular: "JetBrainsMono-Regular.ttf",
  extraBold: "JetBrainsMono-ExtraBold.ttf",
} as const

/**
 * Read a font file from `public/`, or return null where there is no filesystem.
 *
 * `node:fs` is imported dynamically rather than at module scope so that a runtime
 * without it fails here, quietly, instead of at import time - which would take the
 * whole route down rather than just this attempt.
 */
async function fromDisk(file: string): Promise<ArrayBuffer | null> {
  try {
    const { readFile } = await import("node:fs/promises")
    const { join } = await import("node:path")
    const bytes = await readFile(join(process.cwd(), "public", "fonts", file))

    // A Buffer is a view onto a pooled ArrayBuffer, so handing over `.buffer`
    // directly would pass neighbouring allocations too. Copy out just this file.
    return new Uint8Array(bytes).buffer
  } catch {
    return null
  }
}

async function overHttp(file: string): Promise<ArrayBuffer> {
  const response = await fetch(new URL(`/fonts/${file}`, SITE_URL))
  if (!response.ok) throw new Error(`Could not fetch /fonts/${file}: ${response.status}`)

  return response.arrayBuffer()
}

/**
 * The two JetBrains Mono faces the social cards are drawn with.
 *
 * Filesystem first, network second, and both paths are needed. The resume card is
 * prerendered during `next build`, where `public/` is certainly there and reading
 * it is free. A per-article card cannot rely on that: an article published after
 * the last deploy draws its card on demand, and a Cloudflare Workers isolate has
 * no filesystem to read - so it fetches the same files from the deployment's own
 * `/fonts` instead.
 *
 * This is the asset-path rule `ARCHITECTURE.md` records, applied to a route that
 * genuinely runs in both places rather than only one.
 */
export async function loadBrandFonts(): Promise<BrandFonts> {
  const load = async (file: string) => (await fromDisk(file)) ?? overHttp(file)
  const [regular, extraBold] = await Promise.all([load(FILES.regular), load(FILES.extraBold)])

  return { regular, extraBold }
}
