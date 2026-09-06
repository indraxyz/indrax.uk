"use client"

import { Eye, EyeOff, Loader2, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { controlClassNames } from "@/components/ui/variants"
import type { AdminPost } from "@/features/blog/data/admin-queries"
import { deletePost, setPostStatus } from "@/features/blog/data/mutations"
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
    <div className="flex items-center gap-2">
      {error && (
        <p role="alert" className="text-xs font-black uppercase tracking-[0.14em] text-destructive">
          {error}
        </p>
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
    </div>
  )
}
