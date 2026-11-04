import { IMAGE_FORMATS, type ImageMediaType } from "./file-signature.ts"

/**
 * What one kind of upload may contain and where it lands.
 *
 * Every upload feature declares a policy here and goes through the same
 * pipeline in `lib/upload.server.ts`: author session, same-origin request,
 * declared type on the allow-list, size bounded while streaming, bytes matching
 * the declared type, server-generated key under `prefix`. A new feature adds an
 * entry; it does not write a new upload route.
 *
 * Client-safe: the authoring UI reads the same limits to warn before sending.
 * The server's check is the one that decides.
 */
export interface UploadPolicy {
  /** Storage key prefix. Keys are `${prefix}/${uuid}.${extension}`. */
  prefix: string
  maxBytes: number
  types: readonly ImageMediaType[]
}

export const UPLOAD_POLICIES = {
  cover: {
    prefix: "covers",
    maxBytes: 5 * 1024 * 1024,
    types: ["image/jpeg", "image/png", "image/webp", "image/avif"],
  },
  content: {
    prefix: "content",
    maxBytes: 5 * 1024 * 1024,
    types: ["image/jpeg", "image/png", "image/webp", "image/avif"],
  },
} as const satisfies Record<string, UploadPolicy>

export type UploadPurpose = keyof typeof UPLOAD_POLICIES

export function getUploadPolicy(purpose: string | null): UploadPolicy | null {
  return purpose && Object.hasOwn(UPLOAD_POLICIES, purpose)
    ? UPLOAD_POLICIES[purpose as UploadPurpose]
    : null
}

/** "JPEG, PNG, WebP or AVIF", for messages that list what a policy accepts. */
export function describeTypes(policy: UploadPolicy): string {
  const labels = policy.types.map((type) => IMAGE_FORMATS[type].label)
  return labels.length > 1
    ? `${labels.slice(0, -1).join(", ")} or ${labels[labels.length - 1]}`
    : labels.join("")
}

const IMAGE_KEY_PREFIXES = Object.values(UPLOAD_POLICIES)
  .map((policy) => policy.prefix)
  .join("|")
/** Shared generated-key shape for local reads and transactional cleanup candidates. */
export const GENERATED_IMAGE_KEY_PATTERN = `(${IMAGE_KEY_PREFIXES})/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\.(jpg|png|webp|avif)`
const GENERATED_IMAGE_KEY = new RegExp(`^${GENERATED_IMAGE_KEY_PATTERN}$`)

/** Resolve only server-generated keys for a declared upload purpose. */
export function uploadPolicyForKey(value: string): UploadPolicy | null {
  if (!GENERATED_IMAGE_KEY.test(value) || /[\r\n]/.test(value)) return null
  return (
    Object.values(UPLOAD_POLICIES).find((policy) => value.startsWith(`${policy.prefix}/`)) ?? null
  )
}
