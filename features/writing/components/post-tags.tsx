import { useId, useState } from "react"

import { Badge, badgeVariants } from "@/components/ui/badge"
import { TagPill } from "@/features/writing/components/tag-pill"
import type { Tag } from "@/features/writing/types"
import { cn } from "@/lib/utils"

interface PostTagsProps {
  tags: Tag[]
  label?: string
  linkTags?: boolean
}

/** One disclosure per post, shared by article headers and every writing card. */
export function PostTags({ tags, label = "Post tags", linkTags = true }: PostTagsProps) {
  const [expanded, setExpanded] = useState(false)
  const id = useId()
  if (tags.length === 0) return null
  const remaining = tags.length - 2
  const Container = linkTags ? "nav" : "div"
  const tagContent = (tag: Tag) =>
    linkTags ? (
      <TagPill key={tag.id} tag={tag} />
    ) : (
      <Badge key={tag.id} variant="tertiary">
        {tag.name}
      </Badge>
    )

  return (
    <Container
      role={linkTags ? undefined : "group"}
      aria-label={label}
      className={cn("flex flex-wrap items-center gap-2", linkTags && "relative z-10")}
    >
      {tags.slice(0, 2).map(tagContent)}
      {remaining > 0 && (
        <>
          <span id={id} hidden={!expanded} className={expanded ? "contents" : "hidden"}>
            {tags.slice(2).map(tagContent)}
          </span>
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={id}
            aria-label={expanded ? "Show fewer tags" : `Show ${remaining} more tags`}
            onClick={() => setExpanded((value) => !value)}
            className={badgeVariants({
              variant: "tertiary",
              className: "min-h-9 cursor-pointer hover:opacity-85",
            })}
          >
            {expanded ? "Show fewer" : `+${remaining}`}
          </button>
        </>
      )}
    </Container>
  )
}
