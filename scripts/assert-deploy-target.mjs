import { isDeepStrictEqual } from "node:util"
import { pathToFileURL } from "node:url"

/** Compare only deployment boundaries; never serialize complete config or secrets. */
export function deploymentTarget(config) {
  const sort = (entries) =>
    entries.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
  return {
    name: config.name,
    routes: sort(
      (config.routes ?? []).map((route) =>
        typeof route === "string"
          ? { pattern: route, custom_domain: false }
          : { pattern: route.pattern, custom_domain: Boolean(route.custom_domain) }
      )
    ),
    siteUrl: config.vars?.NEXT_PUBLIC_SITE_URL,
    kv: sort((config.kv_namespaces ?? []).map(({ binding, id }) => ({ binding, id }))),
    d1: sort(
      (config.d1_databases ?? []).map(({ binding, database_id, database_name }) => ({
        binding,
        database_id,
        database_name,
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

export async function verifyDeploymentTarget(target) {
  if (!["production", "dev"].includes(target))
    throw new Error("Choose production or dev as the deployment target.")
  const { unstable_readConfig } = await import("wrangler")
  const expected = unstable_readConfig({
    config: "wrangler.jsonc",
    env: target === "dev" ? "dev" : "",
  })
  const actual = unstable_readConfig({ config: "build/server/wrangler.json", env: "" })
  assertDeploymentTarget(actual, expected)
  console.log(`Verified ${target} deployment target: ${expected.name}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await verifyDeploymentTarget(process.argv[2])
