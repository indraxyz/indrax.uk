/**
 * Loads `.env.local` into `process.env` for the database CLI entry points.
 *
 * Next.js reads `.env.local` itself, but drizzle-kit and the seed script are
 * plain Node processes started outside it, so they see nothing unless the
 * variables were exported into the shell. This closes that gap so one file
 * configures every path.
 *
 * Import this only from tooling. Application code must never call it: it would
 * be dead weight in a Workers bundle, which has no filesystem to read from.
 */
export function loadLocalEnv() {
  for (const file of [".env.local", ".env"]) {
    try {
      process.loadEnvFile(file)
    } catch {
      // Absent is the normal case in CI and in production, where the platform
      // injects the variables directly.
    }
  }
}
