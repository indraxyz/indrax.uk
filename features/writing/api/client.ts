import {
  adminArchiveSearchParams,
  type AdminArchiveOptions,
} from "@/features/writing/utils/admin-archive-options"
import { api } from "@/lib/api-client"
import { archiveSearchParams, type ArchiveOptions } from "@/features/writing/utils/archive-options"
import type {
  ActionResult,
  ArchiveResults,
  AdminArchiveResults,
  AdminPost,
  PostSummary,
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
  archive: (options: ArchiveOptions) => ["writing", "archive", options] as const,
  recent: (limit = 3) => ["writing", "recent", limit] as const,
  tags: () => ["writing", "tags"] as const,
  series: (slug: string) => ["writing", "series", slug] as const,
}
export const adminKeys = {
  all: ["admin"] as const,
  session: ["admin", "session"] as const,
  overview: ["admin", "overview"] as const,
  posts: ["admin", "posts"] as const,
  archive: (options: AdminArchiveOptions) => ["admin", "posts", "archive", options] as const,
  tags: () => ["admin", "tags"] as const,
  post: (id: string) => ["admin", "post", id] as const,
}
export const writingApi = {
  archive: (options: ArchiveOptions, signal?: AbortSignal) =>
    api
      .get("/api/writing/posts", { searchParams: archiveSearchParams(options), signal })
      .json<ArchiveResults>(),
  recent: (limit = 3) =>
    api.get("/api/writing/recent", { searchParams: { limit } }).json<PostSummary[]>(),
  tags: () => api.get("/api/writing/tags").json<TagWithCount[]>(),
  series: (slug: string) =>
    api.get(`/api/writing/series/${encodeURIComponent(slug)}`).json<SeriesWithParts>(),
}
export const adminApi = {
  archive: (options: AdminArchiveOptions, signal?: AbortSignal) =>
    api
      .get("/api/admin/posts/archive", { searchParams: adminArchiveSearchParams(options), signal })
      .json<AdminArchiveResults>(),
  tags: () => api.get("/api/admin/tags").json<TagWithCount[]>(),
  session: () => api.get("/api/admin/session").json<AdminSession>(),
  overview: () => api.get("/api/admin/overview").json<AdminOverview>(),
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
