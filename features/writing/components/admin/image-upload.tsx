import { ImageUp } from "lucide-react"
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
  onSelected: (file: File) => void
}

/** Selects and checks a local file; storage writes happen only when the post is saved. */
export function ImageUpload({ onSelected }: ImageUploadProps) {
  const input = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  const select = (file: File) => {
    setError(null)
    if (!ACCEPTED.includes(file.type)) {
      setError(`Images only: ${describeTypes(POLICY)}.`)
      return
    }
    if (file.size > POLICY.maxBytes) {
      setError(`That file is larger than ${POLICY.maxBytes / 1024 / 1024}MB.`)
      return
    }
    onSelected(file)
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
          if (file) select(file)
          event.target.value = ""
        }}
      />

      <button
        type="button"
        aria-label="Upload a cover"
        title="Upload a cover"
        onClick={() => input.current?.click()}
        className={cn(
          controlClassNames,
          "min-h-11 min-w-11 shrink-0 px-3 py-2 disabled:opacity-60"
        )}
      >
        <ImageUp className="h-3.5 w-3.5" aria-hidden />
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
