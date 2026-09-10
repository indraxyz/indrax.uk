import { neon, neonConfig } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"

import * as schema from "./schema"

// No `import "server-only"` here, deliberately, and this is the one place it looks
// like an oversight. `lib/db/seed.ts` and `drizzle.config.ts` are plain Node
// processes that import this module, and `server-only` throws outside a React
// Server Component - adding it breaks `npm run db:seed`. The guard lives one layer
// up in `features/blog/data/queries.ts`, which is the only thing the application
// imports.

export type Database = ReturnType<typeof createClient>

// Hosts that mean "the docker-compose stack in this repo" rather than Neon.
// Loopback only, by construction: a name that resolves through public DNS could in
// principle resolve somewhere else, and matching one here forces the connection
// down to cleartext.
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"])

/**
 * Point the driver at the local Neon-protocol proxy when the connection string
 * names one.
 *
 * The driver assumes Neon, so it builds an `https://<host>/sql` endpoint and
 * negotiates TLS. The proxy in docker-compose.yml speaks plain HTTP, so without
 * this the handshake fails and every query surfaces as an opaque "fetch failed".
 *
 * Scoped to an explicit host allow-list rather than a `NODE_ENV` check: this must
 * never be able to downgrade a production connection to cleartext, whatever the
 * environment happens to claim.
 */
function configureLocalEndpoint(url: string) {
  const { hostname, port } = new URL(url)
  if (!LOCAL_HOSTS.has(hostname)) return

  neonConfig.fetchEndpoint = `http://${hostname}:${port || "4444"}/sql`
  neonConfig.useSecureWebSocket = false
  neonConfig.poolQueryViaFetch = true
}

function createClient(url: string) {
  configureLocalEndpoint(url)

  return drizzle(neon(url), { schema })
}

// Built once and reused. Module scope is per-isolate on Workers, so this is a
// per-isolate memo rather than a global - which is what we want, because the
// connection is stateless HTTP and nothing is pooled across requests anyway.
let client: Database | undefined

/**
 * The database, or `null` when this deployment has none configured.
 *
 * Returning null rather than throwing is deliberate. `DATABASE_URL` is absent in
 * three ordinary situations - a fresh clone, a CI build, a preview that has not
 * been given a branch - and in all three the site should still build and still
 * serve the resume. Callers in `features/blog/data/queries.ts` treat a null
 * database as "no posts", which is the same path as a blog that has not been
 * written yet.
 *
 * Never expose this through a `NEXT_PUBLIC_` variable. The connection string is
 * server-only and must not reach a client bundle (threat T-10).
 */
export function getDb(): Database | null {
  if (client) return client

  const url = process.env.DATABASE_URL
  if (!url) return null

  client = createClient(url)
  return client
}

export { schema }
