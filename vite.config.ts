import { fileURLToPath } from "node:url"
import { randomUUID } from "node:crypto"
import { cloudflare } from "@cloudflare/vite-plugin"
import { reactRouter } from "@react-router/dev/vite"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"
import { adminDevAssets } from "./config/admin-dev-assets.ts"
import { publicEnvDefinitions } from "./config/public-env.ts"

export default defineConfig(({ mode }) => {
  return {
    plugins: [
      adminDevAssets(),
      cloudflare({ viteEnvironment: { name: "ssr" } }),
      tailwindcss(),
      reactRouter(),
      {
        name: "client-entry-signatures",
        enforce: "post",
        configEnvironment(name) {
          if (name !== "client") return
          // React Router sets exports-only; non-recursive Rolldown groups require
          // allow-extension, which preserves route exports while permitting helpers.
          return { build: { rolldownOptions: { preserveEntrySignatures: "allow-extension" } } }
        },
      },
    ],
    resolve: {
      alias: [
        {
          find: /^shiki$/,
          replacement: fileURLToPath(
            new URL("./features/writing/utils/shiki-bundle.ts", import.meta.url)
          ),
        },
        { find: "@", replacement: fileURLToPath(new URL(".", import.meta.url)) },
      ],
    },
    define: {
      ...publicEnvDefinitions(mode),
      "process.env.APP_BUILD_ID": JSON.stringify(randomUUID()),
    },
    environments: {
      client: {
        build: {
          rolldownOptions: {
            output: {
              strictExecutionOrder: true,
              codeSplitting: {
                // Leave shared helpers to automatic splitting to preserve lazy boundaries.
                includeDependenciesRecursively: false,
                groups: [
                  {
                    name: "react-runtime",
                    test: /node_modules[\\/]react(?:-dom)?[\\/]/,
                    priority: 20,
                  },
                  { name: "pdf-fonts", test: /node_modules[\\/]fontkit[\\/]/ },
                  { name: "pdf-writer", test: /node_modules[\\/]pdfkit[\\/]/ },
                  {
                    name: "pdf-text",
                    test: /node_modules[\\/]@react-pdf[\\/](?:hyphenate|textkit)[\\/]/,
                    priority: 10,
                  },
                  {
                    name: "pdf-reconciler",
                    test: /node_modules[\\/]@react-pdf[\\/]reconciler[\\/]/,
                    priority: 10,
                  },
                  {
                    name: "pdf-layout",
                    test: /node_modules[\\/]@react-pdf[\\/]/,
                  },
                ],
              },
            },
          },
        },
      },
    },
    server: { host: "127.0.0.1" },
  }
})
