"use client"

import { Check, Eye, EyeOff, Link2, Loader2, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { controlClassNames } from "@/components/ui/variants"
import type { AdminPost } from "@/features/blog/data/admin-queries"
import { createPreviewLink, deletePost, setPostStatus } from "@/features/blog/data/mutations"
import { cn } from "@/lib/utils"

/**
 * Publish, unpublish and delete.
 *
 * Kept out of the form so that saving a draft and putting it in front of readers
 * are two separate gestures. Deleting asks first, and says what it will do -
 * "cannot be undone" is the only honest description of a cascade (PRD US-3.4).
 */
export function PostActions({ post }: { post: AdminPost }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const published = post.status === "published"

  const run = (action: () => Promise<{ ok: boolean; message?: string }>, then?: () => void) => {
    setError(null)
    startTransition(async () => {
      const result = await action()
      if (!result.ok) {
        setError(result.message ?? "That did not work.")
        return
      }
      then?.()
      router.refresh()
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {error && (
        <p role="alert" className="text-xs font-black uppercase tracking-[0.14em] text-destructive">
          {error}
        </p>
      )}

      {/* Only useful while there is no public page to link to instead. */}
      {!published && (
        <button
          type="button"
          disabled={pending}
          className={cn(controlClassNames, "px-3 py-2 disabled:opacity-60")}
          onClick={() => {
            setError(null)
            startTransition(async () => {
              const result = await createPreviewLink(post.id)
              if (!result.ok || !result.url) {
                setError(result.message ?? "That did not work.")
                return
              }

              const absolute = new URL(result.url, location.origin).toString()

              // Shown either way. Clipboard access can be refused - by a policy, a
              // browser, or a permissions prompt nobody answered - and a link that
              // was silently not copied is worse than one that was never offered.
              setPreviewUrl(absolute)

              try {
                await navigator.clipboard.writeText(absolute)
                setCopied(true)
                window.setTimeout(() => setCopied(false), 3000)
              } catch {
                // Nothing to do: the field below already has it.
              }
            })
          }}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <Link2 className="h-3.5 w-3.5" aria-hidden />
          )}
          {copied ? "Copied" : "Preview link"}
        </button>
      )}

      <button
        type="button"
        disabled={pending}
        className={cn(controlClassNames, "px-3 py-2 disabled:opacity-60")}
        onClick={() => run(() => setPostStatus(post.id, published ? "draft" : "published"))}
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : published ? (
          <EyeOff className="h-3.5 w-3.5" aria-hidden />
        ) : (
          <Eye className="h-3.5 w-3.5" aria-hidden />
        )}
        {published ? "Unpublish" : "Publish"}
      </button>

      <button
        type="button"
        disabled={pending}
        className={cn(
          controlClassNames,
          "variant-destructive px-3 py-2 text-destructive disabled:opacity-60"
        )}
        onClick={() => {
          // A native confirm, deliberately. A custom dialog here would be more
          // code and one more thing to get wrong for a keyboard, to guard the one
          // irreversible action in the application.
          const sure = window.confirm(
            `Delete "${post.title}"? This removes the post and its tag links. It cannot be undone.`
          )
          if (!sure) return

          run(
            () => deletePost(post.id),
            () => router.replace("/admin")
          )
        }}
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden />
        Delete
      </button>

      {previewUrl && (
        <label className="flex w-full items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
          Preview link
          <input
            readOnly
            value={previewUrl}
            aria-label="Preview link"
            onFocus={(event) => event.currentTarget.select()}
            className="min-w-0 flex-1 border-2 border-border bg-card px-2 py-1 font-mono text-[11px] normal-case tracking-normal"
          />
        </label>
      )}
    </div>
  )
}
