import { ChevronRight } from "lucide-react"
import { Link } from "react-router"

import { currentPageClassNames } from "@/components/ui/navigation-link"
import { focusControlClassNames } from "@/components/ui/variants"
import { cn } from "@/lib/utils"

export interface BreadcrumbItem {
  name: string
  path?: string
  reloadDocument?: boolean
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
                prefetch="none"
                to={item.path}
                reloadDocument={item.reloadDocument}
                className={cn(
                  "border-b-2 border-transparent px-1.5 py-1 break-words hover:border-ring hover:bg-muted hover:text-foreground",
                  focusControlClassNames
                )}
              >
                {item.name}
              </Link>
            ) : (
              <span
                aria-current={index === items.length - 1 ? "page" : undefined}
                className={cn(
                  "min-w-0 border-b-2 border-transparent px-1.5 py-1 break-words",
                  index === items.length - 1 && currentPageClassNames
                )}
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
