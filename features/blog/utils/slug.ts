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
