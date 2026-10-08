import { defineCloudflareConfig } from "@opennextjs/cloudflare"
import kvIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/kv-incremental-cache"
import memoryQueue from "@opennextjs/cloudflare/overrides/queue/memory-queue"
import d1NextTagCache from "@opennextjs/cloudflare/overrides/tag-cache/d1-next-tag-cache"

// KV avoids requiring R2 activation for this small, low-traffic site. D1 holds
// tag invalidations independently of KV's eventually consistent cache entries.
// No regional/CDN cache layer: edits must pass through the D1 tag check.
export default defineCloudflareConfig({
  incrementalCache: kvIncrementalCache,
  tagCache: d1NextTagCache,
  // Article/data edits use on-demand expiration; feed and sitemap retain their
  // hourly ISR backstop. Memory deduplication fits this site's low traffic.
  queue: memoryQueue,
  enableCacheInterception: true,
})
