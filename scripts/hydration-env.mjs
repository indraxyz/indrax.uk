import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

/** Keep hydration fixtures out of developer bindings and the public build. */
export async function prepareHydrationEnvironment({
  root,
  source,
  env = /** @type {Record<string, string | undefined>} */ (process.env),
}) {
  const database = env.DATABASE_URL
  if (database && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(database).hostname))
    throw new Error("Hydration browser tests require a loopback DATABASE_URL.")
  const directory = await mkdtemp(join(tmpdir(), "indrax-hydration-"))
  const config = join(directory, "wrangler.json")
  const persist = join(directory, "workers-state")
  const cleanup = () => rm(directory, { recursive: true, force: true })
  try {
    await writeFile(
      config,
      JSON.stringify({
        name: "indrax-hydration",
        main: resolve(root, source.main),
        compatibility_date: source.compatibility_date,
        compatibility_flags: source.compatibility_flags,
        workers_dev: false,
        preview_urls: false,
        assets: { ...source.assets, directory: resolve(root, "public") },
        kv_namespaces: source.kv_namespaces,
        d1_databases: source.d1_databases,
        vars: { ...source.vars, ANALYTICS_ENABLED: "true" },
      }),
      { mode: 0o600 }
    )
    // Only the required fixture binding is forwarded, never the whole CI shell.
    await writeFile(
      join(directory, ".dev.vars"),
      database ? `DATABASE_URL=${JSON.stringify(database)}\n` : "",
      { mode: 0o600 }
    )
    return {
      config,
      persist,
      cleanup,
      env: {
        ...env,
        CLOUDFLARE_ENV: "",
        CLOUDFLARE_VITE_WRANGLER_CONFIG_PATH: config,
        CLOUDFLARE_VITE_FORCE_LOCAL: "true",
        CLOUDFLARE_INCLUDE_PROCESS_ENV: "false",
        INDRAX_VITE_CACHE_DIR: join(directory, "vite-cache"),
        INDRAX_VITE_PERSIST_DIR: persist,
        ANALYTICS_ENABLED: "true",
        ANALYTICS_TRANSPORT: "worker",
      },
    }
  } catch (error) {
    await cleanup()
    throw error
  }
}
