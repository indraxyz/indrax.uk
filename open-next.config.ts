import { defineCloudflareConfig } from "@opennextjs/cloudflare"

// Defaults only, deliberately. An R2 incremental cache and a tag cache are what
// make `revalidateTag` meaningful across isolates, and nothing mutates a post
// until the authoring phase lands - so wiring the bindings now would add two
// pieces of infrastructure with nothing to invalidate. Until then a cache miss
// re-queries, which is correct if not optimal.
export default defineCloudflareConfig()
