/**
 * Optional public address for `npm run dev`, e.g. a local HTTPS reverse proxy.
 *
 * Read from the shared `.env.local` (or exported variables):
 *   DEV_PUBLIC_URL=https://indrax.uk.test   the origin you open in the browser
 *   DEV_HOST=172.26.0.1                     the interface Vite listens on (default 127.0.0.1)
 *   DEV_PORT=5180                           the port Vite listens on (default 5173)
 *
 * Without DEV_PUBLIC_URL nothing changes: Vite keeps its loopback defaults.
 *
 * @param {Record<string, string | undefined>} env
 * @returns {{ host: string, port: number, publicUrl: URL } | null}
 */
export function devAddress(env) {
  const value = env.DEV_PUBLIC_URL?.trim()
  if (!value) return null

  let publicUrl
  try {
    publicUrl = new URL(value)
  } catch {
    throw new Error(`DEV_PUBLIC_URL must be an origin such as https://indrax.uk.test.`)
  }
  if (
    !["http:", "https:"].includes(publicUrl.protocol) ||
    publicUrl.pathname !== "/" ||
    publicUrl.search ||
    publicUrl.hash ||
    publicUrl.username ||
    publicUrl.password
  )
    throw new Error(`DEV_PUBLIC_URL must be an origin such as https://indrax.uk.test.`)

  const host = env.DEV_HOST?.trim() || "127.0.0.1"
  const port = Number(env.DEV_PORT?.trim() || "5173")
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error(`DEV_PORT must be a port number between 1 and 65535.`)

  return { host, port, publicUrl }
}

/** An explicit `--host`/`--port` on the command line (e.g. a test runner) wins. */
export function hasAddressArgument(args) {
  return args.some((arg) => /^--(?:host|port)(?:=|$)/.test(arg))
}
