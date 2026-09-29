import "server-only"

/**
 * Signed, expiring tokens that make one unpublished post readable.
 *
 * A draft 404s publicly, which is right up until the moment the author wants a
 * second opinion before publishing. A token is the narrow exception: it names one
 * slug, it expires, and it cannot be extended or repointed without the secret.
 *
 * Deliberately not a session. Sharing a draft should not mean sharing the ability
 * to write, and whoever opens the link should get exactly one page and nothing
 * else (PRD US-3.3).
 *
 * The payload is not encrypted, only signed - anyone holding a token can read the
 * slug and expiry out of it. That is fine: both are things they already know,
 * because the slug is in the URL they were given.
 */
const ENCODER = new TextEncoder()

// Long enough to read a draft and reply, short enough that a link forwarded on
// months later is dead. The window is deliberately not configurable: an
// indefinite preview token is just an unpublished post with a secret URL.
export const PREVIEW_TTL_MS = 60 * 60 * 1000

function secret(): string {
  const value = process.env.BETTER_AUTH_SECRET

  if (!value) {
    throw new Error("BETTER_AUTH_SECRET is required to sign preview tokens.")
  }

  return value
}

const toBase64Url = (bytes: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")

async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    ENCODER.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )

  return toBase64Url(await crypto.subtle.sign("HMAC", key, ENCODER.encode(payload)))
}

/** A token that makes `slug` readable until it expires. */
export async function createPreviewToken(slug: string, now = Date.now()): Promise<string> {
  const expiresAt = now + PREVIEW_TTL_MS
  const payload = `${slug}.${expiresAt}`

  return `${toBase64Url(ENCODER.encode(payload))}.${await sign(payload)}`
}

/**
 * Whether a token grants access to this slug, right now.
 *
 * Every failure returns the same `false`: expired, tampered, for another post, or
 * malformed are indistinguishable to the caller, because the route turns all of
 * them into the same 404 a draft gives anyone else (threat T-4).
 *
 * The signature is checked against a payload recomputed from the *requested* slug
 * rather than the one carried in the token, so a token minted for one draft
 * cannot be replayed against another.
 */
export async function verifyPreviewToken(
  token: string | undefined,
  slug: string,
  now = Date.now()
): Promise<boolean> {
  if (!token) return false

  const [encodedPayload, signature] = token.split(".")
  if (!encodedPayload || !signature) return false

  let payload: string
  try {
    payload = atob(encodedPayload.replace(/-/g, "+").replace(/_/g, "/"))
  } catch {
    return false
  }

  const separator = payload.lastIndexOf(".")
  if (separator < 0) return false

  const tokenSlug = payload.slice(0, separator)
  const expiresAt = Number(payload.slice(separator + 1))

  if (tokenSlug !== slug) return false
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return false

  const expected = await sign(`${slug}.${expiresAt}`)

  // Constant time, so the comparison cannot be used to discover a valid signature
  // one character at a time.
  if (expected.length !== signature.length) return false

  let mismatch = 0
  for (let index = 0; index < expected.length; index += 1) {
    mismatch |= expected.charCodeAt(index) ^ signature.charCodeAt(index)
  }

  return mismatch === 0
}
