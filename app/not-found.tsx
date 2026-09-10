import { ArrowLeft, FileQuestion } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { BlogShell } from "@/features/blog/components/blog-shell"
import { controlClassNames } from "@/components/ui/variants"
import { BLOG_CONFIG } from "@/features/blog/config"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Not found",
  robots: { index: false, follow: false },
}

/**
 * The 404 for the whole site.
 *
 * It is also what a draft article looks like from outside: an unpublished post is
 * indistinguishable from a slug that was never used, because confirming that the
 * row exists is itself the leak (threat T-4).
 */
export default function NotFound() {
  return (
    <BlogShell>
      <div className="flex flex-col items-center gap-6 border-2 border-border bg-card px-6 py-20 text-center shadow-soft">
        <FileQuestion className="h-10 w-10 text-muted-foreground" aria-hidden />

        <h1 className="text-3xl font-black uppercase tracking-tight">Not found</h1>

        <p className="max-w-md text-sm font-semibold leading-relaxed text-muted-foreground">
          There is nothing at this address. It may have moved, or it may never have been here.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href="/" className={cn(controlClassNames, "px-5 py-3")}>
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Resume
          </Link>
          <Link href={BLOG_CONFIG.basePath} className={cn(controlClassNames, "px-5 py-3")}>
            {BLOG_CONFIG.title}
          </Link>
        </div>
      </div>
    </BlogShell>
  )
}
