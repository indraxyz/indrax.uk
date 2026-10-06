import { ChevronRight } from "lucide-react"
import Link from "next/link"

export interface BreadcrumbItem {
  name: string
  path?: string
}

export function Breadcrumb({ items }: { items: readonly BreadcrumbItem[] }) {
  if (items.length === 0) return null

  return (
    <nav aria-label="Breadcrumb" className="mb-6 print:hidden">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-muted-foreground">
        {items.map((item, index) => (
          <li key={`${item.path ?? ""}-${item.name}`} className="flex min-w-0 items-center gap-2">
            {index > 0 && <ChevronRight className="h-3 w-3 shrink-0" aria-hidden />}
            {index < items.length - 1 && item.path ? (
              <Link
                href={item.path}
                className="break-words hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {item.name}
              </Link>
            ) : (
              <span
                aria-current={index === items.length - 1 ? "page" : undefined}
                className="min-w-0 break-words text-foreground"
              >
                {item.name}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
