import "server-only"

import { unstable_cache } from "next/cache"

import { CACHE_TAGS } from "@/features/writing/data/queries"
import type { Post, RenderedArticle } from "@/features/writing/types"
import { renderDocument } from "@/features/writing/utils/content"

// Bump this when the rendering/sanitization rules change. A cached article must
// never bypass a new sanitizer policy just because its stored document is old.
const RENDER_VERSION = "1"

/** Cache the expensive public render by saved revision, never a draft preview. */
export function getRenderedArticle(post: Post): Promise<RenderedArticle> {
  if (post.status !== "published") {
    throw new Error("Only published articles may use the public render cache.")
  }

  return unstable_cache(
    () => renderDocument(post.content),
    ["writing", "rendered-article", RENDER_VERSION, post.id, post.slug, post.updatedAt],
    { tags: [CACHE_TAGS.post(post.slug)] }
  )()
}
