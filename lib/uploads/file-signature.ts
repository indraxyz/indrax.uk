/**
 * What a file is, read from its bytes rather than taken from its label.
 *
 * A browser's `File.type` and a request's `Content-Type` are both whatever the
 * sender says. These signatures are what the format actually begins with, so a
 * renamed HTML page or SVG labelled `image/png` is recognised as not a PNG.
 *
 * Deliberately a short list of formats that cannot carry script. SVG is not
 * here and must never be added to an upload policy: it is XML and runs
 * JavaScript when opened directly.
 */
export const IMAGE_FORMATS = {
  "image/jpeg": { extension: "jpg", label: "JPEG" },
  "image/png": { extension: "png", label: "PNG" },
  "image/webp": { extension: "webp", label: "WebP" },
  "image/avif": { extension: "avif", label: "AVIF" },
} as const

export type ImageMediaType = keyof typeof IMAGE_FORMATS

/** The most bytes any signature below needs to see. */
export const SIGNATURE_BYTES = 64

const ascii = (bytes: Uint8Array, start: number, end: number) =>
  String.fromCharCode(...bytes.subarray(start, end))

const startsWith = (bytes: Uint8Array, prefix: number[]) =>
  bytes.length >= prefix.length && prefix.every((byte, index) => bytes[index] === byte)

/** AVIF is an ISO-BMFF `ftyp` box naming an AVIF brand, major or compatible. */
function isAvif(bytes: Uint8Array): boolean {
  if (bytes.length < 16 || ascii(bytes, 4, 8) !== "ftyp") return false
  const boxSize = (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]
  const end = Math.min(boxSize, bytes.length)
  for (let offset = 8; offset + 4 <= end; offset += 4) {
    // Offset 12 is the minor version, not a brand.
    if (offset === 12) continue
    if (["avif", "avis"].includes(ascii(bytes, offset, offset + 4))) return true
  }
  return false
}

/** The image format these bytes begin with, or null if none we accept. */
export function detectImageType(bytes: Uint8Array): ImageMediaType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg"
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png"
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP")
    return "image/webp"
  if (isAvif(bytes)) return "image/avif"
  return null
}
