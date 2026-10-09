import { loadEnv } from "vite"
import { resolveSiteUpdatedAt } from "./site-updated-at.ts"

/** Only explicitly public values may be embedded in either browser bundle. */
export function publicEnvDefinitions(mode: string) {
  const env = loadEnv(mode, process.cwd(), "NEXT_PUBLIC_")
  const values = {
    NEXT_PUBLIC_SITE_URL:
      process.env.CLOUDFLARE_ENV === "dev" ? "https://dev.indrax.uk" : "https://indrax.uk",
    NEXT_PUBLIC_MEDIA_ORIGIN: "",
    NEXT_PUBLIC_POSTHOG_HOST: "",
    NEXT_PUBLIC_POSTHOG_KEY: "",
    ...env,
    NEXT_PUBLIC_SITE_UPDATED_AT: resolveSiteUpdatedAt(),
  }
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [`process.env.${key}`, JSON.stringify(value)])
  )
}
