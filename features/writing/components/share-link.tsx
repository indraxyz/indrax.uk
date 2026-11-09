import { useRef, useState } from "react"
import { Share2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ToastProvider, useToast } from "@/components/ui/toast"
import { absoluteUrl } from "@/config/site"
import { WRITING_CONFIG } from "@/features/writing/config"

export const writingShareUrl = (slug: string) =>
  absoluteUrl(`${WRITING_CONFIG.basePath}/${encodeURIComponent(slug)}`)

export async function copyWritingLink(slug: string, clipboard: Pick<Clipboard, "writeText">) {
  await clipboard.writeText(writingShareUrl(slug))
}

/** Public articles only: the URL is constructed without location's query or hash. */
export function ShareLink({ slug }: { slug: string }) {
  return (
    <ToastProvider>
      <ShareButton slug={slug} />
    </ToastProvider>
  )
}

function ShareButton({ slug }: { slug: string }) {
  const toast = useToast()
  const [copying, setCopying] = useState(false)
  const inFlight = useRef(false)

  async function copy() {
    if (inFlight.current) return
    inFlight.current = true
    setCopying(true)
    try {
      await copyWritingLink(slug, navigator.clipboard)
      toast.add({ id: "article-link-copy", title: "Link copied" })
    } catch {
      toast.add({
        id: "article-link-copy",
        title: "Could not copy. Copy the address from your browser.",
      })
    } finally {
      inFlight.current = false
      setCopying(false)
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Copy article link"
      title="Copy article link"
      aria-disabled={copying}
      aria-busy={copying}
      onClick={copy}
      className="print:hidden"
    >
      <Share2 aria-hidden />
    </Button>
  )
}
