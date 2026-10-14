import { assetResponse } from "@/lib/assets.server"

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
  const response = await assetResponse(`/fonts/${file}`)
  if (!response.ok) throw new Error(`Could not fetch /fonts/${file}: ${response.status}`)

  return response.arrayBuffer()
}

/** Load deployment fonts through the asset binding, with disk support for Node tests. */
async function readBrandFonts(): Promise<BrandFonts> {
  const load = async (file: string) => (await fromDisk(file)) ?? overHttp(file)
  const [regular, extraBold] = await Promise.all([load(FILES.regular), load(FILES.extraBold)])

  return { regular, extraBold }
}

// Font bytes are immutable deployment assets. Share in-flight reads and retain
// them for this isolate; a transient failure must allow a later request to retry.
let fonts: Promise<BrandFonts> | undefined

export function loadBrandFonts(): Promise<BrandFonts> {
  fonts ??= readBrandFonts().catch((error: unknown) => {
    fonts = undefined
    throw error
  })
  return fonts
}
