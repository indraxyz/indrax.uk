import {
  getPostForPreview,
  getArchivePosts,
  getRecentPosts,
  getSeriesBySlug,
  getTagsInUse,
  searchPosts,
} from "@/features/writing/data/queries"
import type { ActionResult } from "@/features/writing/types"
import {
  isArchiveDate,
  isArchiveTag,
  MAX_ARCHIVE_TAGS,
  parseArchiveOptions,
} from "@/features/writing/utils/archive-options"
import { parseAdminArchiveOptions } from "@/features/writing/utils/admin-archive-options"
import { WRITING_CONFIG } from "@/features/writing/config"
import { logServerError } from "@/lib/observability"
import { serverEnv } from "@/lib/runtime.server"

import { RequestError as ApiError, readJson } from "@/lib/request-body.server"

function json(value: unknown, status = 200): Response {
  return Response.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  })
}

function validateArchiveParams(params: URLSearchParams): void {
  const tags = params.getAll("tag")
  if (tags.length > MAX_ARCHIVE_TAGS || tags.some((tag) => !isArchiveTag(tag)))
    throw new ApiError(400, "Invalid tags. Select up to ten tags.")
  const query = params.get("q") ?? ""
  if (query.length > WRITING_CONFIG.maxQueryLength)
    throw new ApiError(400, "Search must be 120 characters or fewer.")
  if (params.get("date") === "custom") {
    const from = params.get("from") ?? ""
    const to = params.get("to") ?? ""
    if (
      (!from && !to) ||
      (from && !isArchiveDate(from)) ||
      (to && !isArchiveDate(to)) ||
      (from && to && from > to)
    )
      throw new ApiError(400, "Choose a valid publication date range.")
  }
}

function page(value: string | null, max: number): number {
  const parsed = Number(value ?? "1")
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, max) : 1
}

function mutationResponse(result: ActionResult): Response {
  return json(
    result,
    result.ok ? 200 : result.message === "That post no longer exists." ? 404 : 422
  )
}

/** Direct DTO endpoints: public readers can never access admin/draft queries. */
export async function handleWritingApi(request: Request): Promise<Response | null> {
  const url = new URL(request.url)
  const path = url.pathname.replace(/\/$/, "")
  const isPublic = path.startsWith("/api/writing/")
  const isAdmin = path.startsWith("/api/admin/")
  if (!isPublic && !isAdmin) return null
  try {
    if (isPublic) {
      if (request.method !== "GET") throw new ApiError(405, "This endpoint only accepts GET.")
      const preview = /^\/api\/writing\/preview\/([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(path)
      if (path.startsWith("/api/writing/preview/")) {
        const tokens = url.searchParams.getAll("token")
        const token = tokens[0]
        // Reject malformed/repeated and oversized tokens before crypto or a database read.
        if (
          !preview ||
          preview[1].length > 120 ||
          tokens.length !== 1 ||
          !token ||
          token.length > 1024 ||
          !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)
        ) {
          throw new ApiError(404, "Preview not found.")
        }
        const { verifyPreviewToken } = await import("@/features/writing/utils/preview-token")
        if (!(await verifyPreviewToken(token, preview[1])))
          throw new ApiError(404, "Preview not found.")
        const post = await getPostForPreview(preview[1])
        if (!post) throw new ApiError(404, "Preview not found.")
        // Keep the document processor out of public-card/admin request initialization.
        const { renderDocument } = await import("@/features/writing/utils/content")
        const { content, ...metadata } = post
        return json({ post: metadata, article: await renderDocument(content) })
      }
      if (path === "/api/writing/posts") {
        validateArchiveParams(url.searchParams)
        return json(await getArchivePosts(parseArchiveOptions(url.searchParams)))
      }
      if (path === "/api/writing/recent")
        return json(await getRecentPosts(page(url.searchParams.get("limit") ?? "3", 10)))
      if (path === "/api/writing/tags") return json(await getTagsInUse())
      if (path === "/api/writing/search")
        return json(
          await searchPosts(
            url.searchParams.get("q") ?? undefined,
            page(url.searchParams.get("page"), WRITING_CONFIG.maxSearchPage)
          )
        )
      const series = /^\/api\/writing\/series\/([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(path)
      if (series && series[1].length <= 120) {
        const value = await getSeriesBySlug(series[1])
        return value ? json(value) : json({ ok: false, message: "Series not found." }, 404)
      }
      return json({ ok: false, message: "Endpoint not found." }, 404)
    }

    // Public cards never initialize authentication, authoring or validation modules.
    const [adminQueries, mutations, auth, guard, storage, database, validators] = await Promise.all(
      [
        import("@/features/writing/data/admin-queries"),
        import("@/features/writing/data/mutations"),
        import("@/lib/auth"),
        import("@/lib/auth-guard"),
        import("@/lib/cover-storage"),
        import("@/lib/db"),
        import("@/lib/validators/writing"),
      ]
    )
    const {
      getAdminOverview,
      getPostForEdit,
      listAllPosts,
      getAdminArchivePosts,
      getAdminTagsInUse,
    } = adminQueries
    const { savePost, setPostStatus, deletePost, createPreviewLink } = mutations
    const { postIdSchema, postStatusSchema } = validators
    const author = await guard.getAuthor()
    if (path === "/api/admin/session" && request.method === "GET")
      return json({
        author,
        authConfigured: auth.isAuthConfigured(),
        databaseConfigured: Boolean(database.getDb()),
        coverUploadsConfigured: author ? Boolean(storage.getCoverStorageConfig()) : false,
        previewConfigured: author ? Boolean(serverEnv("BETTER_AUTH_SECRET")) : false,
      })
    if (!author) throw new ApiError(401, "Not authorised.")
    if (path === "/api/admin/overview" && request.method === "GET")
      return json(await getAdminOverview())
    if (path === "/api/admin/posts/archive" && request.method === "GET") {
      validateArchiveParams(url.searchParams)
      return json(await getAdminArchivePosts(parseAdminArchiveOptions(url.searchParams)))
    }
    if (path === "/api/admin/tags" && request.method === "GET")
      return json(await getAdminTagsInUse())
    if (path === "/api/admin/posts" && request.method === "GET") return json(await listAllPosts())
    if (path === "/api/admin/posts" && request.method === "POST") {
      const payload = await readJson(request)
      if (!payload || typeof payload !== "object" || Array.isArray(payload))
        throw new ApiError(400, "Send a post object.")
      const id = (payload as { id?: unknown }).id
      if (id !== undefined && !postIdSchema.safeParse(id).success)
        throw new ApiError(400, "Invalid post id.")
      return mutationResponse(await savePost(payload as Parameters<typeof savePost>[0]))
    }
    const post = /^\/api\/admin\/posts\/([^/]+)(?:\/(status|preview))?$/.exec(path)
    if (post) {
      const [, id, action] = post
      if (!postIdSchema.safeParse(id).success)
        throw new ApiError(404, "That post no longer exists.")
      if (!action && request.method === "GET") {
        const value = await getPostForEdit(id)
        return value
          ? json(value)
          : json({ ok: false, message: "That post no longer exists." }, 404)
      }
      if (
        (!action && request.method === "DELETE") ||
        (action === "preview" && request.method === "POST")
      ) {
        await readJson(request)
        return mutationResponse(action ? await createPreviewLink(id) : await deletePost(id))
      }
      if (action === "status" && request.method === "PATCH") {
        const payload = await readJson(request)
        const parsed = postStatusSchema.safeParse((payload as { status?: unknown } | null)?.status)
        if (!parsed.success) throw new ApiError(422, "Invalid post status.")
        return mutationResponse(await setPostStatus(id, parsed.data))
      }
      throw new ApiError(405, "This request method is not supported.")
    }
    return json({ ok: false, message: "Endpoint not found." }, 404)
  } catch (error) {
    if (error instanceof ApiError) return json({ ok: false, message: error.message }, error.status)
    logServerError(error, { scope: "writing.api" })
    return json(
      { ok: false, message: "The request could not be completed. Please try again." },
      500
    )
  }
}
