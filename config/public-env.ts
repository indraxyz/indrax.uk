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
    "ANALYTICS_TRANSPORT",
    "POSTHOG_PUBLIC_KEY",
    "POSTHOG_PUBLIC_HOST",
  ])
  const transport = env.ANALYTICS_TRANSPORT || "worker"
  if (transport !== "worker" && transport !== "direct")
    throw new Error("ANALYTICS_TRANSPORT must be worker or direct.")
  const direct = transport === "direct"
  const publicHost = direct
    ? env.POSTHOG_PUBLIC_HOST?.trim().replace(/\/+$/, "") || "https://us.i.posthog.com"
    : "https://us.i.posthog.com"
  if (!["https://us.i.posthog.com", "https://eu.i.posthog.com"].includes(publicHost))
    throw new Error("POSTHOG_PUBLIC_HOST must be the US or EU PostHog ingestion host.")
  const publicKey =
    direct && env.ANALYTICS_ENABLED === "true" ? env.POSTHOG_PUBLIC_KEY?.trim() || "" : ""
  if (direct && env.ANALYTICS_ENABLED === "true" && !/^phc_[A-Za-z0-9_-]+$/.test(publicKey))
    throw new Error("Direct analytics requires a POSTHOG_PUBLIC_KEY project ingestion key (phc_…).")
  const mediaOverride = env.MEDIA_ORIGIN?.trim()
  const localOverride =
    mediaOverride === LOCAL_MEDIA_PREFIX.slice(0, -1) || Boolean(localMediaOrigin(mediaOverride))
  const values = {
    SITE_URL:
      env.SITE_URL ||
      (process.env.CLOUDFLARE_ENV === "dev" ? "https://dev.indrax.uk" : "https://indrax.uk"),
    ANALYTICS_ENABLED: env.ANALYTICS_ENABLED === "true" ? "true" : "false",
    ANALYTICS_TRANSPORT: transport,
    POSTHOG_PUBLIC_KEY: publicKey,
    POSTHOG_PUBLIC_HOST: publicHost,
    // Runtime credentials, including POSTHOG_PROJECT_TOKEN, stay private.
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
