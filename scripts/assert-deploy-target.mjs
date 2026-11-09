import { isDeepStrictEqual } from "node:util"
import { pathToFileURL } from "node:url"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { getDeploymentTarget } from "../config/deployment-targets.mjs"

/** Compare only deployment boundaries; never serialize complete config or secrets. */
export function deploymentTarget(config) {
  const sort = (entries) =>
    entries.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
  return {
    name: config.name,
    workersDev: config.workers_dev,
    previewUrls: config.preview_urls,
    observability: config.observability,
    routes: sort(
      (config.routes ?? []).map((route) =>
        typeof route === "string"
          ? { pattern: route, custom_domain: false, enabled: true, previews_enabled: false }
          : {
              pattern: route.pattern,
              custom_domain: Boolean(route.custom_domain),
              enabled: route.enabled ?? true,
              previews_enabled: route.previews_enabled ?? false,
            }
      )
    ),
    siteUrl: config.vars?.SITE_URL,
    mediaOrigin: config.vars?.MEDIA_ORIGIN,
    maintenanceEnabled: config.vars?.PREVIEW_MAINTENANCE_ENABLED,
    authUrl: config.vars?.BETTER_AUTH_URL,
    crons: [...(config.triggers?.crons ?? [])].sort(),
    r2: sort(
      (config.r2_buckets ?? []).map(({ binding, bucket_name }) => ({ binding, bucket_name }))
    ),
    kv: sort((config.kv_namespaces ?? []).map(({ binding, id }) => ({ binding, id }))),
    d1: sort(
      (config.d1_databases ?? []).map(({ binding, database_id, database_name }) => ({
        binding,
        database_id,
        database_name,
      }))
    ),
    rateLimits: sort(
      (config.ratelimits ?? []).map(({ name, namespace_id, simple }) => ({
        name,
        namespace_id,
        simple,
      }))
    ),
  }
}

export function assertDeploymentTarget(actual, expected) {
  const built = deploymentTarget(actual)
  const source = deploymentTarget(expected)
  for (const field of Object.keys(source)) {
    if (!isDeepStrictEqual(built[field], source[field]))
      throw new Error(
        `Deployment target mismatch: ${field}. Rebuild for the intended environment before deploying.`
      )
  }
}

export function assertStagingIsolation(production, staging) {
  for (const [field, identity] of [
    ["kv_namespaces", "id"],
    ["d1_databases", "database_id"],
    ["r2_buckets", "bucket_name"],
    ["ratelimits", "namespace_id"],
  ]) {
    const productionIds = new Set((production[field] ?? []).map((entry) => entry[identity]))
    if (
      !staging[field]?.length ||
      staging[field].some((entry) => !entry[identity] || productionIds.has(entry[identity]))
    )
      throw new Error(`Staging must use isolated ${field}.`)
  }
  if (staging.triggers?.crons?.length || staging.routes?.length)
    throw new Error("Preview settings must not contain production routes or Cron Triggers.")
  if (
    production.vars?.PREVIEW_MAINTENANCE_ENABLED === "true" ||
    production.vars?.PREVIEW_MAINTENANCE_TOKEN
  )
    throw new Error("Production must not enable Preview maintenance.")
}

export function assertBuildManifest(manifest, target) {
  const expected = { target, ...getDeploymentTarget(target) }
  // JSON omits undefined previewName in production manifests.
  if (!isDeepStrictEqual(manifest, JSON.parse(JSON.stringify(expected))))
    throw new Error("Build manifest does not match the intended deployment target. Rebuild first.")
}

export async function verifyDeploymentTarget(target) {
  const identity = getDeploymentTarget(target)
  const { unstable_readConfig } = await import("wrangler")
  const expected = unstable_readConfig({
    config: "wrangler.jsonc",
    env: "",
  })
  const actual = unstable_readConfig({ config: "build/server/wrangler.json", env: "" })
  assertDeploymentTarget(actual, expected)
  // Production deployment also installs the Preview base/domain configuration.
  // Check that Vite preserved it even when uploading production rather than staging.
  if (actual.previews || expected.previews) {
    if (!actual.previews || !expected.previews)
      throw new Error("Preview settings must be preserved in the generated config.")
    assertDeploymentTarget(actual.previews, expected.previews)
  }
  const effective = target === "staging" ? actual.previews : actual
  if (
    actual.name !== identity.workerName ||
    effective?.vars?.SITE_URL !== identity.siteUrl ||
    effective?.vars?.MEDIA_ORIGIN !== identity.mediaOrigin
  )
    throw new Error("Worker identity does not match the deployment contract.")
  if (target === "staging") {
    if (!actual.previews || !expected.previews)
      throw new Error("Staging requires explicit Preview settings in the generated config.")
    assertStagingIsolation(actual, actual.previews)
    if (
      actual.previews.vars?.BETTER_AUTH_URL !== identity.siteUrl ||
      actual.previews.vars?.PREVIEW_MAINTENANCE_ENABLED !== "true"
    )
      throw new Error("Staging Preview identity does not match the deployment contract.")
  } else if (
    target === "production" &&
    (actual.vars?.PREVIEW_MAINTENANCE_ENABLED === "true" || actual.vars?.PREVIEW_MAINTENANCE_TOKEN)
  ) {
    throw new Error("Production must not enable Preview maintenance.")
  }
  const assets = actual.assets
  if (
    assets?.binding !== "ASSETS" ||
    resolve("build/server", assets.directory ?? "") !== resolve("build/client")
  )
    throw new Error("Generated Worker assets must point to the assembled client build.")
  const manifest = JSON.parse(await readFile("build/deployment-target.json", "utf8"))
  assertBuildManifest(manifest, target)
  console.log(
    `Verified ${target} deployment target: ${identity.workerName}${identity.previewName ? ` / ${identity.previewName}` : ""}`
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await verifyDeploymentTarget(process.argv[2])
