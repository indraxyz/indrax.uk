import type { ReactNode } from "react"

import {
  Card,
  CardContent,
  CardHeader,
  type CardHeight,
  type CardVariant,
} from "@/components/ui/card"
import { variantClassNames, type VisualVariant } from "@/components/ui/variants"
import { cn } from "@/lib/utils"

interface SectionCardProps {
  title: string
  icon: ReactNode
  children: ReactNode
  tone?: VisualVariant
  variant?: CardVariant
  height?: CardHeight
  className?: string
  headerClassName?: string
  contentClassName?: string
}

export function SectionCard({
  title,
  icon,
  children,
  tone = "primary",
  variant = "card",
  height = "auto",
  className,
  headerClassName,
  contentClassName,
}: SectionCardProps) {
  const isGhost = variant === "ghost"

  return (
    <Card
      variant={variant}
      height={height}
      className={cn(
        variantClassNames[tone],
        !isGhost && "bg-[var(--variant-soft)]",
        className
      )}
    >
      <CardHeader
        variant={variant}
        className={cn(
          !isGhost && "variant-surface-header border-b-2",
          headerClassName
        )}
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-none",
              !isGhost &&
                `variant-icon border-2 ${variantClassNames[tone]}`,
              isGhost && "text-current"
            )}
          >
            {icon}
          </div>
          <h2 className="text-xl font-black uppercase tracking-tight">{title}</h2>
        </div>
      </CardHeader>
      <CardContent
        variant={variant}
        className={cn(!isGhost && "pt-6", contentClassName)}
      >
        {children}
      </CardContent>
    </Card>
  )
}
