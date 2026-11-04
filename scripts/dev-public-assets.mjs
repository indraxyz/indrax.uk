import { cp } from "node:fs/promises"
import { isAbsolute, join, resolve } from "node:path"

/** One public root for the development asset binding, middleware and watched admin. */
export function devPublicDirectory(value, projectDirectory = process.cwd()) {
  if (!value) return resolve(projectDirectory, "public")
  if (!isAbsolute(value)) throw new Error("INDRAX_DEV_PUBLIC_DIR must be an absolute path.")
  return resolve(value)
}

/** Copy static inputs, never the concurrently watched/generated admin output. */
export async function copyPublicAssets(source, destination) {
  const directory = resolve(source)
  await cp(directory, resolve(destination), {
    recursive: true,
    filter: (candidate) => candidate !== join(directory, "admin"),
  })
}
