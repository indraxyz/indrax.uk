import { access, rm } from "node:fs/promises"
// The independent CSR admin is emitted into the Worker's existing client assets.
await access("build/client/admin/index.html")
await access("build/server/wrangler.json")
// Cloudflare emits local bindings for its own preview. Our preview reads the
// root .env.local explicitly, so keep that secret copy out of build artifacts.
await rm("build/server/.dev.vars", { force: true })
console.log("SSR Worker and static CSR admin build ready.")
