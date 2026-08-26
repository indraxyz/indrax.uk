import type { ReactNode } from "react"

interface InfoItemProps {
  icon: ReactNode
  label: string
  value: string | ReactNode
}

export function InfoItem({ icon, label, value }: InfoItemProps) {
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="mt-1 shrink-0 text-muted-foreground">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-0.5 break-words text-sm font-medium">{value}</p>
      </div>
    </div>
  )
}
