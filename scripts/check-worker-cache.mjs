import { readFileSync } from "node:fs"
import { parseConfigFileTextToJson } from "typescript"

// OpenNext populates caches before wrangler deploy, so automatic resource
// provisioning at deploy time is too late for a first release.
const environment = process.argv[2] ?? ""
if (!["", "dev"].includes(environment)) {
  throw new Error("Expected the default environment or dev.")
}

const parsed = parseConfigFileTextToJson("wrangler.jsonc", readFileSync("wrangler.jsonc", "utf8"))
if (parsed.error) throw new Error("Could not parse wrangler.jsonc.")
const config = environment ? parsed.config.env?.[environment] : parsed.config
const kv = config?.kv_namespaces?.find((entry) => entry.binding === "NEXT_INC_CACHE_KV")
const d1 = config?.d1_databases?.find((entry) => entry.binding === "NEXT_TAG_CACHE_D1")

const productionKv = parsed.config.kv_namespaces?.find(
  (entry) => entry.binding === "NEXT_INC_CACHE_KV"
)
const developmentKv = parsed.config.env?.dev?.kv_namespaces?.find(
  (entry) => entry.binding === "NEXT_INC_CACHE_KV"
)
const productionD1 = parsed.config.d1_databases?.find(
  (entry) => entry.binding === "NEXT_TAG_CACHE_D1"
)
const developmentD1 = parsed.config.env?.dev?.d1_databases?.find(
  (entry) => entry.binding === "NEXT_TAG_CACHE_D1"
)

if (
  (productionKv?.id && productionKv.id === developmentKv?.id) ||
  (productionD1?.database_id && productionD1.database_id === developmentD1?.database_id)
) {
  throw new Error("Development and production must use separate Worker cache resources.")
}

if (!kv?.id || !d1?.database_id) {
  throw new Error(
    `Worker cache resources are not provisioned for ${environment || "production"}. ` +
      "Create the isolated KV namespace and D1 database, then record their IDs in wrangler.jsonc. " +
      "See docs/worker-cpu-optimization.md before releasing."
  )
}

console.log(`Worker cache bindings are configured for ${environment || "production"}.`)
