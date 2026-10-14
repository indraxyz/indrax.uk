import { loadEnv } from "vite"
import { resolveSiteUpdatedAt } from "./site-updated-at.ts"
import { localMediaOrigin, LOCAL_MEDIA_PREFIX } from "../lib/uploads/local-media.ts"

/** Only explicitly public values may be embedded in either browser bundle. */
export function publicEnvDefinitions(mode: string) {
  const env = loadEnv(mode, process.cwd(), "NEXT_PUBLIC_")
  const mediaOverride = env.NEXT_PUBLIC_MEDIA_ORIGIN?.trim()
  const localOverride =
    mediaOverride === LOCAL_MEDIA_PREFIX.slice(0, -1) || Boolean(localMediaOrigin(mediaOverride))
  const values = {
    NEXT_PUBLIC_SITE_URL:
      env.NEXT_PUBLIC_SITE_URL ||
      (process.env.CLOUDFLARE_ENV === "dev" ? "https://dev.indrax.uk" : "https://indrax.uk"),
    NEXT_PUBLIC_ANALYTICS_ENABLED: env.NEXT_PUBLIC_ANALYTICS_ENABLED === "true" ? "true" : "false",
    // An explicit allowlist prevents old NEXT_PUBLIC_POSTHOG_KEY values in local
    // files or CI from embedding an ingestion credential in browser bundles.
    NEXT_PUBLIC_MEDIA_ORIGIN:
      (mode !== "production" || !localOverride ? mediaOverride : undefined) ||
      (process.env.CLOUDFLARE_ENV === "dev"
        ? "https://dev-media.indrax.uk"
        : "https://media.indrax.uk"),
    NEXT_PUBLIC_SITE_UPDATED_AT: resolveSiteUpdatedAt(),
  }
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [`process.env.${key}`, JSON.stringify(value)])
  )
}
