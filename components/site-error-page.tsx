import { ArrowLeft, FileQuestion } from "lucide-react"
import { Link } from "react-router"

import { WritingShell } from "@/features/writing/components/writing-shell"
import { controlClassNames } from "@/components/ui/variants"
import { WRITING_CONFIG } from "@/features/writing/config"
import { cn } from "@/lib/utils"

/**
 * The 404 for the whole site.
 *
 * It is also what a draft article looks like from outside: an unpublished post is
 * indistinguishable from a slug that was never used, because confirming that the
 * row exists is itself the leak (threat T-4).
 */
export function SiteErrorPage({ status = 404 }: { status?: number }) {
  const notFound = status === 404
  return (
    <WritingShell activePage={null}>
      <title>{notFound ? "Not found" : "Something went wrong"}</title>
      <meta name="robots" content="noindex, nofollow" />
      <div className="flex flex-col items-center gap-6 border-2 border-border bg-card px-6 py-20 text-center shadow-soft">
        <FileQuestion className="h-10 w-10 text-muted-foreground" aria-hidden />

        <h1 className="text-3xl font-black uppercase tracking-tight">
          {notFound ? "Not found" : "Something went wrong"}
        </h1>

        <p className="max-w-md text-sm font-semibold leading-relaxed text-muted-foreground">
          {notFound
            ? "There is nothing at this address. It may have moved, or it may never have been here."
            : "The page could not be loaded. Please try again later."}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link prefetch="none" to="/" className={cn(controlClassNames, "px-5 py-3")}>
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Home
          </Link>
          <Link
            prefetch="none"
            to={WRITING_CONFIG.basePath}
            className={cn(controlClassNames, "px-5 py-3")}
          >
            {WRITING_CONFIG.title}
          </Link>
        </div>
      </div>
    </WritingShell>
  )
}
