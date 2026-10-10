import { fileURLToPath } from "node:url"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"
import { THEME_INIT_SCRIPT } from "./lib/theme.ts"
import { publicEnvDefinitions } from "./config/public-env.ts"

export default defineConfig(({ mode }) => {
  return {
    root: "admin",
    base: "/admin/",
    publicDir: false,
    plugins: [
      {
        name: "admin-theme",
        transformIndexHtml: (html) =>
          html.replace("<!--theme-init-->", `<script>${THEME_INIT_SCRIPT}</script>`),
      },
      react(),
      tailwindcss(),
    ],
    resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
    define: {
      ...publicEnvDefinitions(mode),
      "process.env.NODE_ENV": JSON.stringify(mode === "production" ? "production" : "development"),
    },
    build: {
      outDir: "../build/client/admin",
      emptyOutDir: true,
      rolldownOptions: {
        preserveEntrySignatures: "allow-extension",
        output: {
          strictExecutionOrder: true,
          codeSplitting: {
            includeDependenciesRecursively: false,
            groups: [
              {
                name: "react-runtime",
                test: /node_modules[\\/]react(?:-dom)?[\\/]/,
                priority: 20,
              },
              { name: "router-runtime", test: /node_modules[\\/]react-router[\\/]/ },
            ],
          },
        },
      },
    },
  }
})
