import { access } from "node:fs/promises"
// The independent CSR admin is emitted into the Worker's existing client assets.
await access("build/client/admin/index.html")
await access("build/server/wrangler.json")
console.log("SSR Worker and static CSR admin build ready.")
