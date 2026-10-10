import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { parseEnv } from "node:util"

// Only application bindings belong in the Worker; never copy the whole shell
// (which may contain CI, cloud-provider or developer-tool credentials).
export const PREVIEW_VARIABLES = [
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "ALLOWED_GITHUB_ID",
  "GITHUB_CLIENT_ID",
  "GITHUB_CLIENT_SECRET",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
  "NEXT_PUBLIC_MEDIA_ORIGIN",
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_POSTHOG_KEY",
  "NEXT_PUBLIC_POSTHOG_HOST",
  "NEXT_PUBLIC_SITE_UPDATED_AT",
  "NODE_ENV",
]

function dotenvValue(value, name) {
  // Dotenv expands backslash-n only inside double quotes. Prefer single quotes
  // or backticks so literal backslashes, hashes and multiline secrets survive.
  for (const quote of ["'", "`", '"']) {
    if (!value.includes(quote) && (quote !== '"' || !/\\[nr]/.test(value)))
      return `${quote}${value}${quote}`
  }
  if (!/[#\r\n]/.test(value) && value.trim() === value && !/^["'`]/.test(value)) return value
  throw new Error(`Cannot encode preview variable ${name} in an environment file.`)
}

/** Wrangler resolves default env files beside the generated build config. Explicit
 * absolute --env-file paths use the one project .env.local instead, followed by a
 * protected, short-lived override for shell fixtures and the preview auth origin.
 */
export async function preparePreviewEnvironment({
  root,
  port,
  env = /** @type {Record<string, string | undefined>} */ (process.env),
  temporaryRoot = tmpdir(),
}) {
  const localFile = resolve(root, ".env.local")
  let local = {}
  let hasLocalFile = false
  try {
    local = parseEnv(await readFile(localFile, "utf8"))
    hasLocalFile = true
  } catch (error) {
    if (error.code !== "ENOENT") throw error
  }
  const values = Object.fromEntries(
    PREVIEW_VARIABLES.filter((name) => env[name] !== undefined).map((name) => [name, env[name]])
  )
  values.BETTER_AUTH_URL = env.BETTER_AUTH_URL ?? `http://127.0.0.1:${port}`
  const overrides = Object.entries(values).filter(([name, value]) => local[name] !== value)
  // Wrangler forwards explicit env files to Node, which rejects missing paths.
  // CI has shell fixtures but deliberately has no developer .env.local file.
  const args = hasLocalFile ? ["--env-file", localFile] : []
  let directory
  const cleanup = async () => {
    if (directory) await rm(directory, { recursive: true, force: true })
  }
  try {
    if (overrides.length) {
      const content =
        overrides.map(([name, value]) => `${name}=${dotenvValue(value, name)}`).join("\n") + "\n"
      directory = await mkdtemp(join(temporaryRoot, "indrax-preview-env-"))
      await chmod(directory, 0o700)
      const file = join(directory, ".env")
      await writeFile(file, content, { mode: 0o600, flag: "wx" })
      args.push("--env-file", file)
    }
    return { args, cleanup }
  } catch (error) {
    await cleanup()
    throw error
  }
}
