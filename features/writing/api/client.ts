import { api } from "@/lib/api-client"
import type {
  ActionResult,
  AdminPost,
  AdminPostSummary,
  PaginatedPosts,
  PostSummary,
  SearchResults,
  SeriesWithParts,
  TagWithCount,
} from "@/features/writing/types"

export interface AdminSession {
  author: { id: string; name: string; email: string } | null
  authConfigured: boolean
  coverUploadsConfigured: boolean
  databaseConfigured: boolean
  previewConfigured: boolean
}
export interface AdminOverview {
  total: number
  published: number
  drafts: number
  archived: number
  latestDraft: { id: string; title: string } | null
}
export const writingKeys = {
  all: ["writing"] as const,
  posts: (page = 1, tag = "") => ["writing", "posts", page, tag] as const,
  recent: (limit = 3) => ["writing", "recent", limit] as const,
  tags: () => ["writing", "tags"] as const,
  search: (q: string, page = 1) => ["writing", "search", q, page] as const,
  series: (slug: string) => ["writing", "series", slug] as const,
}
export const adminKeys = {
  all: ["admin"] as const,
  session: ["admin", "session"] as const,
  overview: ["admin", "overview"] as const,
  posts: ["admin", "posts"] as const,
  post: (id: string) => ["admin", "post", id] as const,
}
export const writingApi = {
  posts: (page = 1, tag = "") =>
    api
      .get("/api/writing/posts", { searchParams: { page, ...(tag ? { tag } : {}) } })
      .json<PaginatedPosts>(),
  recent: (limit = 3) =>
    api.get("/api/writing/recent", { searchParams: { limit } }).json<PostSummary[]>(),
  tags: () => api.get("/api/writing/tags").json<TagWithCount[]>(),
  search: (q: string, page = 1) =>
    api.get("/api/writing/search", { searchParams: { q, page } }).json<SearchResults>(),
  series: (slug: string) =>
    api.get(`/api/writing/series/${encodeURIComponent(slug)}`).json<SeriesWithParts>(),
}
export const adminApi = {
  session: () => api.get("/api/admin/session").json<AdminSession>(),
  overview: () => api.get("/api/admin/overview").json<AdminOverview>(),
  posts: () => api.get("/api/admin/posts").json<AdminPostSummary[]>(),
  post: (id: string) => api.get(`/api/admin/posts/${encodeURIComponent(id)}`).json<AdminPost>(),
  savePost: (input: unknown) =>
    api
      .post("/api/admin/posts", {
        json: input,
        throwHttpErrors: (status) => status === 401 || status === 403 || status >= 500,
      })
      .json<ActionResult>(),
  setPostStatus: (id: string, status: string) =>
    api
      .patch(`/api/admin/posts/${encodeURIComponent(id)}/status`, {
        json: { status },
        throwHttpErrors: (status) => status === 401 || status === 403 || status >= 500,
      })
      .json<ActionResult>(),
  deletePost: (id: string) =>
    api.delete(`/api/admin/posts/${encodeURIComponent(id)}`, { json: {} }).json<ActionResult>(),
  createPreviewLink: (id: string) =>
    api
      .post(`/api/admin/posts/${encodeURIComponent(id)}/preview`, { json: {} })
      .json<ActionResult & { url?: string }>(),
}
