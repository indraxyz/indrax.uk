import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import type { VisualVariant } from "@/components/ui/variants"
import type { Tag } from "@/features/blog/types"

interface TagPillProps {
  tag: Tag
  tone?: VisualVariant
  count?: number
}

export function TagPill({ tag, tone = "tertiary", count }: TagPillProps) {
  return (
    <Link
      href={`/blog/tag/${tag.slug}`}
      className="rounded-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <Badge variant={tone} className="transition-colors hover:opacity-85">
        {tag.name}
        {typeof count === "number" && (
          // Parenthesised rather than a separate element: a screen reader reads
          // "TypeScript (4)" as one label, which is what the link means.
          //
          // No opacity. Fading it to 70% measured 4.32:1 against the tertiary chip,
          // under the 4.5:1 AA needs - and the parentheses already do the
          // de-emphasis the opacity was reaching for (NFR-4).
          <span className="ml-2">({count})</span>
        )}
      </Badge>
    </Link>
  )
}
