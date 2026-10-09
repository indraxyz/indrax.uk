/**
 * Loads `.env.local` into `process.env` for the database CLI entry points.
 *
 * Drizzle-kit and the seed script run as plain Node processes outside Vite,
 * so they see nothing unless the
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
