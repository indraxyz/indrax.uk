import { api } from "@/lib/api-client"
import { ImageUp, Loader2 } from "lucide-react"
import { useRef, useState } from "react"

import { controlClassNames } from "@/components/ui/variants"
import { describeTypes, UPLOAD_POLICIES } from "@/lib/uploads/policy"
import { cn } from "@/lib/utils"

// The same policy the upload route enforces, so the author is told before a
// request is made. The server's check is the one that decides - this one exists
// to save a round trip, not to enforce anything (threat T-5).
const POLICY = UPLOAD_POLICIES.cover
const ACCEPTED: readonly string[] = POLICY.types

interface ImageUploadProps {
  onUploaded: (url: string) => void
}

/**
 * Uploads a cover through the upload route, which verifies it before storing.
 *
 * The file goes to the Worker rather than straight to storage so its size and
 * its actual format are checked server-side; see `lib/upload.server.ts`.
 */
export function ImageUpload({ onUploaded }: ImageUploadProps) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const upload = async (file: File) => {
    setError(null)

    if (!ACCEPTED.includes(file.type)) {
      setError(`Images only: ${describeTypes(POLICY)}.`)
      return
    }

    if (file.size > POLICY.maxBytes) {
      setError(`That file is larger than ${POLICY.maxBytes / 1024 / 1024}MB.`)
      return
    }

    setBusy(true)

    try {
      const response = await api.post("/api/upload", {
        searchParams: { purpose: "cover" },
        headers: { "content-type": file.type },
        body: file,
        throwHttpErrors: false,
        // A few megabytes on a slow uplink outlasts the default.
        timeout: 120_000,
      })

      if (!response.ok) {
        const body = await response.json<{ error?: string }>().catch(() => ({ error: undefined }))
        setError(body.error ?? "That upload was refused.")
        return
      }

      const { publicUrl } = await response.json<{ publicUrl: string }>()

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
    <>
      <input
        ref={input}
        type="file"
        accept={ACCEPTED.join(",")}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void upload(file)
        }}
      />

      <button
        type="button"
        disabled={busy}
        aria-label="Upload a cover"
        title="Upload a cover"
        aria-busy={busy}
        onClick={() => input.current?.click()}
        className={cn(
          controlClassNames,
          "min-h-11 min-w-11 shrink-0 px-3 py-2 disabled:opacity-60"
        )}
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : (
          <ImageUp className="h-3.5 w-3.5" aria-hidden />
        )}
      </button>

      {error && (
        <p
          role="alert"
          className="col-span-2 text-xs font-black uppercase tracking-[0.14em] text-destructive"
        >
          {error}
        </p>
      )}
    </>
  )
}
