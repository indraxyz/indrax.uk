import { fileURLToPath } from "node:url"
import { randomUUID } from "node:crypto"
import { cloudflare } from "@cloudflare/vite-plugin"
import { reactRouter } from "@react-router/dev/vite"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"
import { publicEnvDefinitions } from "./config/public-env.ts"

export default defineConfig(({ mode }) => {
  return {
    plugins: [cloudflare({ viteEnvironment: { name: "ssr" } }), tailwindcss(), reactRouter()],
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
    server: { host: "127.0.0.1" },
  }
})
