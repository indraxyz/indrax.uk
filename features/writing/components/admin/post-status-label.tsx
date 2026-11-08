import type { PostStatus } from "@/features/writing/types"
import { cn } from "@/lib/utils"
import { STATUS_UNDERLINE } from "./post-display"

/** The word conveys status independently of the decorative, token-based underline. */
export function PostStatusLabel({ status }: { status: PostStatus }) {
  return (
    <span
      data-post-status={status}
      className={cn(
        "inline-block text-[11px] font-black uppercase leading-6 tracking-[0.14em] text-foreground underline decoration-[3px] underline-offset-[5px]",
        STATUS_UNDERLINE[status]
      )}
    >
      {status}
    </span>
  )
}
