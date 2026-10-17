import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { expect, it } from "vitest"
import { pdfLayoutBuffer } from "./pdf-layout-buffer"

const transform = pdfLayoutBuffer().transform as (
  code: string,
  id: string
) => { code: string; map: null } | undefined

it("supplies the installed layout's image buffer check with a module import", async () => {
  const path = fileURLToPath(import.meta.resolve("@react-pdf/layout"))
  const source = await readFile(path, "utf8")
  expect(source).toContain("Buffer.isBuffer(source)")
  const transformed = transform(source, path)
  expect(transformed?.code).toMatch(/^import \{ Buffer \} from "buffer\/";/)
  expect(transformed?.code).not.toMatch(/(?:window|globalThis)\.Buffer\s*=/)
})

it("leaves unrelated modules and layouts without the buffer check alone", () => {
  expect(transform("Buffer.isBuffer(source)", "/app/image.ts")).toBeUndefined()
  expect(
    transform("export default layout", "/node_modules/@react-pdf/layout/lib/index.js")
  ).toBeUndefined()
})
