import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"
import { THEME_INIT_SCRIPT } from "./lib/theme.ts"
import { publicEnvDefinitions } from "./config/public-env.ts"

const LOADING_INDICATOR_SVG = readFileSync(
  new URL("./components/ui/loading-spinner.svg", import.meta.url),
  "utf8"
).trim()

export default defineConfig(({ mode }) => {
  return {
    root: "admin",
    base: "/admin/",
    publicDir: false,
    plugins: [
      {
        name: "admin-shell",
        transformIndexHtml: (html) =>
          html
            .replace("<!--theme-init-->", `<script>${THEME_INIT_SCRIPT}</script>`)
            // The same vector the React loader renders, so both spinners are one icon.
            .replace("<!--loading-indicator-->", LOADING_INDICATOR_SVG),
      },
      react(),
      tailwindcss(),
    ],
    resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
    define: {
      ...publicEnvDefinitions(mode),
      // The local admin is built and watched, rather than served by Vite.
      // Its development mode must still accept configured loopback media URLs.
      "import.meta.env.DEV": mode === "development",
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
