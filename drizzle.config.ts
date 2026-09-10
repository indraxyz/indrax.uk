import { defineConfig } from "drizzle-kit"

import { loadLocalEnv } from "./lib/db/dev-env"

loadLocalEnv()

// drizzle-kit speaks the Postgres wire protocol, not Neon's HTTP one, so it is
// pointed at the database directly rather than through the proxy the application
// uses. Locally that is the `postgres` service in docker-compose.yml; against Neon
// the two are the same host and `DATABASE_URL` alone is enough.
const url = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL

if (!url) {
  throw new Error(
    "DIRECT_DATABASE_URL or DATABASE_URL must be set to run drizzle-kit. " +
      "Locally: npm run db:up, then copy .env.example to .env.local."
  )
}

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
  // Every migration is reviewed as SQL before it is applied, so a destructive one
  // cannot slip through as a side effect of a schema edit (PRD US-6.1).
  strict: true,
  verbose: true,
})
