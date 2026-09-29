import type { Metadata } from "next"
import type { ReactNode } from "react"

// Nothing under /admin is the same for two requests, and none of it may be
// cached: a stale draft list is worse than a slow one.
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  // Belt and braces with robots.txt and the header `proxy.ts` sets. A disallow
  // asks a crawler not to fetch; this tells one that ignored the ask not to index
  // what it found (PRD US-4.2).
  robots: { index: false, follow: false, nocache: true },
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return children
}
