import { useState } from "react"
import { Check, Share2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { absoluteUrl } from "@/config/site"
import { WRITING_CONFIG } from "@/features/writing/config"

export const writingShareUrl = (slug: string) =>
  absoluteUrl(`${WRITING_CONFIG.basePath}/${encodeURIComponent(slug)}`)

export async function copyWritingLink(slug: string, clipboard: Pick<Clipboard, "writeText">) {
  await clipboard.writeText(writingShareUrl(slug))
}

/** Public articles only: the URL is constructed without location's query or hash. */
export function ShareLink({ slug }: { slug: string }) {
  const [result, setResult] = useState<"copied" | "error" | null>(null)
  const [copying, setCopying] = useState(false)

  async function copy() {
    setCopying(true)
    setResult(null)
    try {
      await copyWritingLink(slug, navigator.clipboard)
      setResult("copied")
    } catch {
      setResult("error")
    } finally {
      setCopying(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Copy article link"
        title="Copy article link"
        disabled={copying}
        onClick={copy}
      >
        {result === "copied" ? <Check aria-hidden /> : <Share2 aria-hidden />}
      </Button>
      <span role="status" className="text-xs text-muted-foreground">
        {result === "copied"
          ? "Link copied"
          : result === "error"
            ? "Could not copy. Copy the address from your browser."
            : ""}
      </span>
    </div>
  )
}
