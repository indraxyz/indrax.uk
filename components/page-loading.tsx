import { LoaderCircle } from "lucide-react"

/** Initial load has no previous page to retain. */
export function PageLoading() {
  return (
    <div
      role="status"
      aria-label="Loading page"
      className="fixed inset-0 z-[90] grid place-items-center bg-background/95"
    >
      <LoaderCircle
        className="h-8 w-8 animate-spin motion-reduce:animate-none"
        style={{ color: "var(--component-navigation-progress)" }}
        aria-hidden="true"
      />
      <span className="sr-only">Loading page</span>
    </div>
  )
}
