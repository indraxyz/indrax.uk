"use client"

import { AlertTriangle, RotateCw } from "lucide-react"
import Link from "next/link"

import { controlClassNames } from "@/components/ui/variants"
import { BLOG_CONFIG } from "@/features/blog/config"
import { cn } from "@/lib/utils"

interface ErrorPageProps {
  error: Error & { digest?: string }
  reset: () => void
}

/**
 * What a server error looks like.
 *
 * It exists so that a failure answers 500 rather than something misleading. The
 * article route deliberately lets a database error propagate instead of turning
 * it into a 404, because a 404 tells a crawler the article was deleted - this is
 * where that error lands.
 *
 * `error.digest` is the correlation id: Next logs the real stack server-side under
 * that same hash and hands the client only the hash, so the reason is findable
 * without a stack trace reaching the reader (PRD US-6.2).
 *
 * A client component, because that is what an error boundary has to be - which is
 * also why it does not use `BlogShell`: that pulls in server-only imports.
 */
export default function ErrorPage({ error, reset }: ErrorPageProps) {
  return (
    <main className="container mx-auto flex min-h-screen max-w-3xl items-center px-4">
      <div className="flex w-full flex-col items-center gap-6 border-2 border-border bg-card px-6 py-20 text-center shadow-soft">
        <AlertTriangle className="h-10 w-10 text-muted-foreground" aria-hidden />

        <h1 className="text-3xl font-black uppercase tracking-tight">Something broke</h1>

        <p className="max-w-md text-sm font-semibold leading-relaxed text-muted-foreground">
          This page could not be built just now. It is not gone - try again in a moment.
        </p>

        {error.digest && (
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
            Reference {error.digest}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button type="button" onClick={reset} className={cn(controlClassNames, "px-5 py-3")}>
            <RotateCw className="h-3.5 w-3.5" aria-hidden />
            Try again
          </button>
          <Link href="/" className={cn(controlClassNames, "px-5 py-3")}>
            Resume
          </Link>
          <Link href={BLOG_CONFIG.basePath} className={cn(controlClassNames, "px-5 py-3")}>
            {BLOG_CONFIG.title}
          </Link>
        </div>
      </div>
    </main>
  )
}
