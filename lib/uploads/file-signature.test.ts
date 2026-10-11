import { expect, it } from "vitest"
import { detectImageType } from "./file-signature"

const bytes = (...values: (number | string)[]) =>
  new Uint8Array(
    values.flatMap((value) =>
      typeof value === "string" ? [...value].map((char) => char.charCodeAt(0)) : [value]
    )
  )

const ftyp = (major: string, ...compatible: string[]) =>
  bytes(0, 0, 0, 16 + compatible.length * 4, "ftyp", major, 0, 0, 0, 0, ...compatible)

it.each([
  ["JPEG", bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0x10, "JFIF"), "image/jpeg"],
  ["PNG", bytes(0x89, "PNG", 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, "IHDR"), "image/png"],
  ["WebP", bytes("RIFF", 0x24, 0, 0, 0, "WEBPVP8 "), "image/webp"],
  ["AVIF (major brand)", ftyp("avif", "mif1"), "image/avif"],
  ["AVIF sequence", ftyp("avis"), "image/avif"],
  ["AVIF (compatible brand)", ftyp("mif1", "miaf", "avif"), "image/avif"],
])("recognises %s from its bytes", (_, input, expected) => {
  expect(detectImageType(input)).toBe(expected)
})

it.each([
  ["HTML", bytes("<!doctype html><script>alert(1)</script>")],
  ["SVG", bytes('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>')],
  ["GIF", bytes("GIF89a", 1, 0, 1, 0)],
  ["PDF", bytes("%PDF-1.7")],
  ["a RIFF that is not WebP", bytes("RIFF", 0x24, 0, 0, 0, "WAVEfmt ")],
  ["HEIC, an ftyp box with no AVIF brand", ftyp("heic", "mif1")],
  ["the minor version spelling avif", bytes(0, 0, 0, 16, "ftyp", "mif1", "avif")],
  ["a truncated PNG signature", bytes(0x89, "PN")],
  ["nothing", new Uint8Array()],
])("refuses %s", (_, input) => {
  expect(detectImageType(input)).toBeNull()
})
