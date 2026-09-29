import { PenLine } from "lucide-react"

interface EmptyStateProps {
  message: string
}

/**
 * What `/blog` looks like before anything is written - and what it looks like if
 * the database is unreachable, which the query layer deliberately renders as the
 * same thing (PRD US-2.1, US-6.2).
 */
export function EmptyState({ message }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-4 border-2 border-dashed border-border px-6 py-16 text-center">
      <PenLine className="h-8 w-8 text-muted-foreground" aria-hidden />
      <p className="max-w-md text-sm font-semibold leading-relaxed text-muted-foreground">
        {message}
      </p>
    </div>
  )
}
