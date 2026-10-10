import type { AdminPost, PostDocument, PostStatus } from "@/features/writing/types"

/** Keep raw editable values together so a save acknowledges its exact submitted
 * snapshot, while later edits and reverting fields remain accurately tracked. */
export interface PostFormFields {
  title: string
  slug: string
  excerpt: string
  status: PostStatus
  tags: string
  coverUrl: string
  coverAlt: string
  body: PostDocument | null
  seriesTitle: string
  seriesDescription: string
  seriesOrder: string
}
export function createPostFormFields(post: AdminPost | null): PostFormFields {
  return {
    title: post?.title ?? "",
    slug: post?.slug ?? "",
    excerpt: post?.excerpt ?? "",
    status: post?.status ?? "draft",
    tags: post?.tags.map((tag) => tag.name).join(", ") ?? "",
    coverUrl: post?.coverUrl ?? "",
    coverAlt: post?.coverAlt ?? "",
    body: post?.content ?? null,
    seriesTitle: post?.seriesTitle ?? "",
    seriesDescription: post?.seriesDescription ?? "",
    seriesOrder:
      post?.seriesOrder === null || post?.seriesOrder === undefined ? "" : String(post.seriesOrder),
  }
}
export function postFormSnapshot(fields: PostFormFields): string {
  return JSON.stringify(fields)
}
