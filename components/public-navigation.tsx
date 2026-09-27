import { House } from "lucide-react"
import Link from "next/link"

const linkClassName =
  "text-xs font-black uppercase tracking-[0.14em] text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"

export type PublicPage = "home" | "resume" | "blogs" | "tech-stack"

export function PublicNavigation({ activePage }: { activePage?: PublicPage | null }) {
  return (
    <nav aria-label="Site" className="flex items-center gap-3 sm:gap-4">
      <Link
        href="/"
        aria-label="Home"
        title="Home"
        aria-current={activePage === "home" ? "page" : undefined}
        className={linkClassName}
      >
        <House className="h-4 w-4" aria-hidden />
      </Link>
      <Link
        href="/resume"
        aria-current={activePage === "resume" ? "page" : undefined}
        className={linkClassName}
      >
        Resume
      </Link>
      <Link
        href="/blog"
        aria-current={activePage === "blogs" ? "page" : undefined}
        className={linkClassName}
      >
        Blogs
      </Link>
      <Link
        href="/tech-stack"
        aria-current={activePage === "tech-stack" ? "page" : undefined}
        className={linkClassName}
      >
        Tech Stack
      </Link>
    </nav>
  )
}
