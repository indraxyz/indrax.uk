"use client"

import { AlertTriangle, Loader2, Save } from "lucide-react"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { controlClassNames } from "@/components/ui/variants"
import { ImageUpload } from "@/features/blog/components/admin/image-upload"
import { savePost, type ActionResult } from "@/features/blog/data/mutations"
import type { AdminPost } from "@/features/blog/data/admin-queries"
import { POST_STATUSES, type PostDocument, type PostStatus } from "@/features/blog/types"
import { slugify } from "@/features/blog/utils/slug"
import { cn } from "@/lib/utils"

/**
 * Tiptap arrives only when this form does.
 *
 * `ssr: false` behind `next/dynamic` keeps the editor, ProseMirror and the whole
 * toolbar out of every bundle but this one - which is what NFR-6 asks for, and
 * what stops an author's tooling costing a reader anything.
 */
const PostEditor = dynamic(
  () => import("@/features/blog/components/admin/editor").then((mod) => mod.PostEditor),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[28rem] border-2 border-border bg-card" aria-busy>
        <span className="sr-only">Loading the editor</span>
      </div>
    ),
  }
)

const fieldClasses =
  "w-full border-2 border-border bg-card px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"

const labelClasses = "text-xs font-black uppercase tracking-[0.14em] text-muted-foreground"

interface PostFormProps {
  post: AdminPost | null
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null

  return (
    <p role="alert" className="text-xs font-black uppercase tracking-[0.14em] text-destructive">
      {messages[0]}
    </p>
  )
}

export function PostForm({ post }: PostFormProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<ActionResult | null>(null)

  const [title, setTitle] = useState(post?.title ?? "")
  const [slug, setSlug] = useState(post?.slug ?? "")
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? "")
  const [status, setStatus] = useState<PostStatus>(post?.status ?? "draft")
  const [tags, setTags] = useState(post?.tags.map((tag) => tag.name).join(", ") ?? "")
  const [coverUrl, setCoverUrl] = useState(post?.coverUrl ?? "")
  const [coverAlt, setCoverAlt] = useState(post?.coverAlt ?? "")
  const [document, setDocument] = useState<PostDocument | null>(post?.content ?? null)

  // Changing the address of something already published breaks every link to it
  // that exists in the world. Worth saying out loud, at the moment it is being
  // done, rather than in a changelog afterwards (PRD US-3.2).
  const slugWillBreakLinks =
    post?.status === "published" && slug.trim().length > 0 && slug.trim() !== post.slug

  const submit = () => {
    setResult(null)

    startTransition(async () => {
      const outcome = await savePost({
        id: post?.id,
        title: title.trim(),
        slug: slug.trim() || undefined,
        excerpt: excerpt.trim() || undefined,
        content: document ?? { type: "doc", content: [] },
        coverUrl: coverUrl.trim() || undefined,
        coverAlt: coverAlt.trim() || undefined,
        status,
        tags: tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      })

      setResult(outcome)

      if (outcome.ok && outcome.postId) {
        router.replace(`/admin/edit/${outcome.postId}`)
        router.refresh()
      }
    })
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      {result?.ok === false && result.message && (
        <p
          role="alert"
          className="flex items-center gap-2 border-2 border-destructive bg-[var(--component-variant-destructive-soft)] px-4 py-3 text-sm font-black uppercase tracking-[0.14em] text-destructive"
        >
          <AlertTriangle className="h-4 w-4" aria-hidden />
          {result.message}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="title" className={labelClasses}>
              Title
            </label>
            <input
              id="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              onBlur={() => {
                // Only ever fills an empty slug. Silently rewriting one that
                // already exists would change a published URL as a side effect of
                // an unrelated edit.
                if (!slug && title) setSlug(slugify(title))
              }}
              className={cn(fieldClasses, "text-lg font-black")}
              required
            />
            <FieldError messages={result?.errors?.title} />
          </div>

          <PostEditor value={document} onChange={setDocument} />
          <FieldError messages={result?.errors?.content} />
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="status" className={labelClasses}>
              Status
            </label>
            <select
              id="status"
              value={status}
              onChange={(event) => setStatus(event.target.value as PostStatus)}
              className={fieldClasses}
            >
              {POST_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="slug" className={labelClasses}>
              Slug
            </label>
            <input
              id="slug"
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              placeholder="derived from the title"
              className={cn(fieldClasses, "font-mono")}
            />
            <FieldError messages={result?.errors?.slug} />
            {slugWillBreakLinks && (
              <p className="flex items-start gap-2 border-2 border-border bg-[var(--color-muted)] px-3 py-2 text-xs font-semibold leading-relaxed">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                This post is published. Changing its slug breaks every existing link to{" "}
                <span className="font-mono">/blog/{post?.slug}</span>.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="tags" className={labelClasses}>
              Tags
            </label>
            <input
              id="tags"
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="Next.js, TypeScript"
              className={fieldClasses}
            />
            <p className="text-xs font-medium text-muted-foreground">
              Comma separated. Matching ignores case and punctuation.
            </p>
            <FieldError messages={result?.errors?.tags} />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="excerpt" className={labelClasses}>
              Excerpt
            </label>
            <textarea
              id="excerpt"
              value={excerpt}
              onChange={(event) => setExcerpt(event.target.value)}
              rows={4}
              placeholder="derived from the body"
              className={fieldClasses}
            />
            <FieldError messages={result?.errors?.excerpt} />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="coverUrl" className={labelClasses}>
              Cover image
            </label>
            <input
              id="coverUrl"
              value={coverUrl}
              onChange={(event) => setCoverUrl(event.target.value)}
              placeholder="https://..."
              className={cn(fieldClasses, "font-mono text-xs")}
            />
            <FieldError messages={result?.errors?.coverUrl} />

            <ImageUpload onUploaded={setCoverUrl} />

            <label htmlFor="coverAlt" className={cn(labelClasses, "block pt-2")}>
              Cover alt text
            </label>
            <input
              id="coverAlt"
              value={coverAlt}
              onChange={(event) => setCoverAlt(event.target.value)}
              className={fieldClasses}
            />
            <FieldError messages={result?.errors?.coverAlt} />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 border-t-2 border-border pt-6">
        <button
          type="submit"
          disabled={pending}
          className={cn(controlClassNames, "px-5 py-3 disabled:opacity-60")}
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Save className="h-3.5 w-3.5" aria-hidden />
          )}
          {pending ? "Saving" : "Save"}
        </button>

        <p aria-live="polite" className={labelClasses}>
          {result?.ok ? "Saved." : ""}
        </p>
      </div>
    </form>
  )
}
