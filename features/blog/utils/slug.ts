// The shape a slug must have to be accepted, and the shape `slugify` guarantees:
// lowercase alphanumeric groups joined by single hyphens, no leading, trailing or
// doubled separator. Enforced server-side on write, never trusted from a client.
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Turn arbitrary text into a URL-safe slug.
 *
 * Accents are decomposed and their marks dropped rather than transliterated, so
 * "Café" becomes "cafe" instead of "caf". Everything else that is not a letter or
 * a digit collapses to a single hyphen - which is why "Next.js" and "next js"
 * both arrive at "next-js", and why tag normalisation can lean on this to
 * de-duplicate.
 */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/**
 * A slug that no existing post holds.
 *
 * `taken` is the set of slugs already in use. On collision a numeric suffix is
 * appended and incremented until the result is free, so a second "Hello World"
 * becomes "hello-world-2" rather than failing the unique constraint at insert
 * time (PRD US-3.1).
 *
 * The uniqueness this gives is advisory - two writers racing would still collide
 * at the database, which is where the real constraint lives. With one author that
 * race does not exist, and the constraint is the backstop either way.
 */
export function uniqueSlug(input: string, taken: Iterable<string>): string {
  const base = slugify(input) || "post"
  const used = new Set(taken)

  if (!used.has(base)) return base

  let suffix = 2
  while (used.has(`${base}-${suffix}`)) suffix += 1

  return `${base}-${suffix}`
}
