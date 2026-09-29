"use client"

import { AlertTriangle, Loader2, Save } from "lucide-react"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { controlClassNames } from "@/components/ui/variants"
import { ImageUpload } from "@/features/blog/components/admin/image-upload"
import { savePost } from "@/features/blog/data/mutations"
import type { ActionResult } from "@/features/blog/types"
import {
  POST_STATUSES,
  type AdminPost,
  type PostDocument,
  type PostStatus,
} from "@/features/blog/types"
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

/**
 * A field-level message, tied to the field it belongs to.
 *
 * The `id` matters as much as the text: without `aria-describedby` pointing at it
 * from the input, someone tabbing back to a rejected field is told nothing at all
 * about why it was rejected. `role="alert"` announces it once, on arrival; the
 * association is what makes it findable afterwards.
 */
function FieldError({ id, messages }: { id: string; messages?: string[] }) {
  if (!messages?.length) return null

  return (
    <p
      id={id}
      role="alert"
      className="text-xs font-black uppercase tracking-[0.14em] text-destructive"
    >
      {messages[0]}
    </p>
  )
}

/** Wires an input to its error message, or to nothing when there is none. */
const describedBy = (field: string, messages?: string[]) =>
  messages?.length ? { "aria-invalid": true, "aria-describedby": `${field}-error` } : {}

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
  const [body, setBody] = useState<PostDocument | null>(post?.content ?? null)
  const [seriesTitle, setSeriesTitle] = useState(post?.seriesTitle ?? "")
  const [seriesDescription, setSeriesDescription] = useState(post?.seriesDescription ?? "")
  // A string, not a number: an empty box is "" and `Number("")` is 0, which would
  // silently claim part zero of a series nobody named.
  const [seriesOrder, setSeriesOrder] = useState(
    post?.seriesOrder === null || post?.seriesOrder === undefined ? "" : String(post.seriesOrder)
  )

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
        content: body ?? { type: "doc", content: [] },
        coverUrl: coverUrl.trim() || undefined,
        coverAlt: coverAlt.trim() || undefined,
        status,
        tags: tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        seriesTitle: seriesTitle.trim() || undefined,
        seriesDescription: seriesDescription.trim() || undefined,
        // Undefined rather than NaN for an empty or unparseable box - the schema
        // reads "absent", which with no series title is the standalone post that
        // most articles are.
        seriesOrder: seriesOrder.trim() ? Number(seriesOrder) : undefined,
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
              {...describedBy("title", result?.errors?.title)}
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
            <FieldError id="title-error" messages={result?.errors?.title} />
          </div>

          <PostEditor value={body} onChange={setBody} />
          <FieldError id="content-error" messages={result?.errors?.content} />
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
              {...describedBy("slug", result?.errors?.slug)}
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              placeholder="derived from the title"
              className={cn(fieldClasses, "font-mono")}
            />
            <FieldError id="slug-error" messages={result?.errors?.slug} />
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
              {...describedBy("tags", result?.errors?.tags)}
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="Next.js, TypeScript"
              className={fieldClasses}
            />
            <p className="text-xs font-medium text-muted-foreground">
              Comma separated. Matching ignores case and punctuation.
            </p>
            <FieldError id="tags-error" messages={result?.errors?.tags} />
          </div>

          <fieldset className="space-y-1.5 border-2 border-border p-3">
            <legend className={`${labelClasses} px-1`}>Series</legend>

            <label htmlFor="seriesTitle" className="sr-only">
              Series title
            </label>
            <input
              id="seriesTitle"
              {...describedBy("seriesTitle", result?.errors?.seriesTitle)}
              value={seriesTitle}
              onChange={(event) => setSeriesTitle(event.target.value)}
              placeholder="Building a blog"
              className={fieldClasses}
            />
            <FieldError id="seriesTitle-error" messages={result?.errors?.seriesTitle} />

            <label htmlFor="seriesOrder" className="sr-only">
              Part number
            </label>
            <input
              id="seriesOrder"
              type="number"
              min={1}
              max={999}
              {...describedBy("seriesOrder", result?.errors?.seriesOrder)}
              value={seriesOrder}
              onChange={(event) => setSeriesOrder(event.target.value)}
              placeholder="Part number"
              className={fieldClasses}
            />
            <FieldError id="seriesOrder-error" messages={result?.errors?.seriesOrder} />

            <label htmlFor="seriesDescription" className="sr-only">
              Series description
            </label>
            <textarea
              id="seriesDescription"
              {...describedBy("seriesDescription", result?.errors?.seriesDescription)}
              value={seriesDescription}
              onChange={(event) => setSeriesDescription(event.target.value)}
              rows={2}
              placeholder="Series description (optional)"
              className={fieldClasses}
            />
            <FieldError id="seriesDescription-error" messages={result?.errors?.seriesDescription} />

            <p className="text-xs font-medium text-muted-foreground">
              Both or neither. Matching ignores case and punctuation, so retyping the title slightly
              joins the same series rather than starting a second one.
            </p>
          </fieldset>

          <div className="space-y-1.5">
            <label htmlFor="excerpt" className={labelClasses}>
              Excerpt
            </label>
            <textarea
              id="excerpt"
              {...describedBy("excerpt", result?.errors?.excerpt)}
              value={excerpt}
              onChange={(event) => setExcerpt(event.target.value)}
              rows={4}
              placeholder="derived from the body"
              className={fieldClasses}
            />
            <FieldError id="excerpt-error" messages={result?.errors?.excerpt} />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="coverUrl" className={labelClasses}>
              Cover image
            </label>
            <input
              id="coverUrl"
              {...describedBy("coverUrl", result?.errors?.coverUrl)}
              value={coverUrl}
              onChange={(event) => setCoverUrl(event.target.value)}
              placeholder="https://..."
              className={cn(fieldClasses, "font-mono text-xs")}
            />
            <FieldError id="coverUrl-error" messages={result?.errors?.coverUrl} />

            <ImageUpload onUploaded={setCoverUrl} />

            <label htmlFor="coverAlt" className={cn(labelClasses, "block pt-2")}>
              Cover alt text
            </label>
            <input
              id="coverAlt"
              {...describedBy("coverAlt", result?.errors?.coverAlt)}
              value={coverAlt}
              onChange={(event) => setCoverAlt(event.target.value)}
              className={fieldClasses}
            />
            <FieldError id="coverAlt-error" messages={result?.errors?.coverAlt} />
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
