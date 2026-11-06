import { access, rm, writeFile } from "node:fs/promises"
import { buildTarget } from "../config/deployment-targets.mjs"
import { writeAssetIndexingHeaders } from "./asset-indexing.mjs"
// The independent CSR admin is emitted into the Worker's existing client assets.
await access("build/client/admin/index.html")
await access("build/server/wrangler.json")
// Cloudflare emits local bindings for its own preview. Our preview reads the
// root .env.local explicitly, so keep that secret copy out of build artifacts.
await rm("build/server/.dev.vars", { force: true })
// This public manifest proves the explicit target used by both Vite builds.
// Ordinary local builds are not release artifacts, even if their default is prod.
const targetName = process.env.DEPLOYMENT_TARGET || "local"
const target = buildTarget()
await writeAssetIndexingHeaders("build/client", targetName)
await writeFile(
  "build/deployment-target.json",
  JSON.stringify({ target: targetName, ...target }, null, 2) + "\n"
)
console.log("SSR Worker and static CSR admin build ready.")
