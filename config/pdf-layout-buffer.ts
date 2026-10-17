import type { Plugin } from "vite"

const layoutModule = /\/node_modules\/@react-pdf\/layout\/lib\/index\.js(?:\?.*)?$/

function transformLayout(code: string, id: string) {
  // @react-pdf/layout 5.2.0 uses Buffer.isBuffer when assigning image keys,
  // but ships no import. Remove this workaround when upstream supplies it.
  if (!layoutModule.test(id) || !code.includes("Buffer.isBuffer")) return
  return { code: `import { Buffer } from "buffer/";\n${code}`, map: null }
}

/** Supply layout's missing Buffer import without adding a browser global. */
export function pdfLayoutBuffer(): Plugin {
  return {
    name: "pdf-layout-buffer",
    enforce: "pre",
    config: () => ({
      // Dev prebundling must receive the same fix while retaining CommonJS interop.
      optimizeDeps: {
        rolldownOptions: {
          plugins: [{ name: "pdf-layout-buffer-deps", transform: transformLayout }],
        },
      },
    }),
    transform: transformLayout,
  }
}
