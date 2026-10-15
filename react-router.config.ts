import type { Config } from "@react-router/dev/config"

export default {
  ssr: true,
  appDirectory: "app",
  // Scan client entry and route dependencies before the first browser request.
  future: { unstable_optimizeDeps: true },
} satisfies Config
