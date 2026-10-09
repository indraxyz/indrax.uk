import ky from "ky"
import { api } from "@/lib/api-client"
import { ImageUp, Loader2 } from "lucide-react"
import { useRef, useState } from "react"

import { controlClassNames } from "@/components/ui/variants"
import { cn } from "@/lib/utils"

// Mirrors the route's own limits so the author is told before a request is made.
// The check that decides is the one in the upload API - this one exists
// to save a round trip, not to enforce anything (threat T-5).
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"]
const MAX_BYTES = 5 * 1024 * 1024

interface ImageUploadProps {
  onUploaded: (url: string) => void
}

/**
 * Uploads a cover straight to storage using a URL the server mints.
 *
 * The file never touches the application: the server signs a short-lived,
 * single-key URL and the browser PUTs to it directly. That keeps a
 * multi-megabyte body out of a Worker's memory and time budget entirely.
 */
export function ImageUpload({ onUploaded }: ImageUploadProps) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const upload = async (file: File) => {
    setError(null)

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Images only: JPEG, PNG, WebP or AVIF.")
      return
    }

    if (file.size > MAX_BYTES) {
      setError(`That file is larger than ${MAX_BYTES / 1024 / 1024}MB.`)
      return
    }

    setBusy(true)

    try {
      const minted = await api.post("/api/upload", {
        throwHttpErrors: false,
        json: {
          contentType: file.type,
          size: file.size,
          fileName: file.name,
        },
      })

      if (!minted.ok) {
        const body = await minted.json<{ error?: string }>().catch(() => ({ error: undefined }))
        setError(body.error ?? "That upload was refused.")
        return
      }

      const { uploadUrl, publicUrl, contentType } = await minted.json<{
        uploadUrl: string
        publicUrl: string
        contentType: string
      }>()

      const put = await ky.put(uploadUrl, {
        credentials: "omit",
        retry: 0,
        throwHttpErrors: false,
        headers: { "content-type": contentType },
        body: file,
      })

      if (!put.ok) {
        setError("Storage refused the upload.")
        return
      }

      onUploaded(publicUrl)
    } catch {
      setError("That upload did not complete.")
    } finally {
      setBusy(false)
      // Cleared so choosing the same file twice still fires a change event.
      if (input.current) input.current.value = ""
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={input}
        type="file"
        accept={ALLOWED_TYPES.join(",")}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void upload(file)
        }}
      />

      <button
        type="button"
        disabled={busy}
        onClick={() => input.current?.click()}
        className={cn(controlClassNames, "px-3 py-2 disabled:opacity-60")}
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : (
          <ImageUp className="h-3.5 w-3.5" aria-hidden />
        )}
        {busy ? "Uploading" : "Upload a cover"}
      </button>

      {error && (
        <p role="alert" className="text-xs font-black uppercase tracking-[0.14em] text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
