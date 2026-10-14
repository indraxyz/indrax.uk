import { loadEnv } from "vite"
import { resolveSiteUpdatedAt } from "./site-updated-at.ts"
import { localMediaOrigin, LOCAL_MEDIA_PREFIX } from "../lib/uploads/local-media.ts"

/** Only explicitly public values may be embedded in either browser bundle. */
export function publicEnvDefinitions(mode: string) {
  const env = loadEnv(mode, process.cwd(), [
    "SITE_URL",
    "SITE_UPDATED_AT",
    "MEDIA_ORIGIN",
    "ANALYTICS_ENABLED",
  ])
  const mediaOverride = env.MEDIA_ORIGIN?.trim()
  const localOverride =
    mediaOverride === LOCAL_MEDIA_PREFIX.slice(0, -1) || Boolean(localMediaOrigin(mediaOverride))
  const values = {
    SITE_URL:
      env.SITE_URL ||
      (process.env.CLOUDFLARE_ENV === "dev" ? "https://dev.indrax.uk" : "https://indrax.uk"),
    ANALYTICS_ENABLED: env.ANALYTICS_ENABLED === "true" ? "true" : "false",
    // Only these four settings reach the browser; runtime credentials stay private.
    MEDIA_ORIGIN:
      (mode !== "production" || !localOverride ? mediaOverride : undefined) ||
      (process.env.CLOUDFLARE_ENV === "dev"
        ? "https://dev-media.indrax.uk"
        : "https://media.indrax.uk"),
    SITE_UPDATED_AT: resolveSiteUpdatedAt(env.SITE_UPDATED_AT),
  }
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [`process.env.${key}`, JSON.stringify(value)])
  )
}
