import type { ReactNode } from "react"

import {
  Card,
  CardContent,
  CardHeader,
  isBoundedHeight,
  type CardHeight,
  type CardVariant,
} from "@/components/ui/card"
import { SectionHeader, type SectionLink } from "@/components/ui/section-header"
import { variantClassNames, type VisualVariant } from "@/components/ui/variants"
import { cn } from "@/lib/utils"

interface SectionCardProps {
  title: string
  icon: ReactNode
  children: ReactNode
  subtitle?: string
  link?: SectionLink
  tone?: VisualVariant
  variant?: CardVariant
  height?: CardHeight
  // Lays the children out as a horizontal rail of cards. Owned here rather than
  // passed as classes so every rail also gets the same scroll-region semantics.
  carousel?: boolean
  className?: string
  headerClassName?: string
  contentClassName?: string
}

export function SectionCard({
  title,
  icon,
  children,
  subtitle,
  link,
  tone = "primary",
  variant = "card",
  height = "auto",
  carousel = false,
  className,
  headerClassName,
  contentClassName,
}: SectionCardProps) {
  const isGhost = variant === "ghost"
  const isBounded = isBoundedHeight(height)
  // A height-capped pane scrolls vertically and a rail scrolls horizontally; both
  // strand their content unless a keyboard can reach and a screen reader can name
  // the scroller itself.
  const scrolls = isBounded || carousel

  return (
    <Card
      variant={variant}
      height={height}
      className={cn(variantClassNames[tone], !isGhost && "bg-[var(--variant-soft)]", className)}
    >
      <CardHeader className={cn("variant-surface-header border-b-2", headerClassName)}>
        <SectionHeader
          icon={icon}
          title={title}
          subtitle={subtitle}
          link={link}
          tone={tone}
          size={isGhost ? "lg" : "sm"}
        />
      </CardHeader>
      <CardContent
        variant={variant}
        scrollable={scrolls}
        aria-label={scrolls ? title : undefined}
        data-print-columns={carousel ? "" : undefined}
        className={cn(
          isGhost ? "py-6 print:py-2" : "pt-6 print:pt-2",
          carousel && "flex gap-6 overflow-x-auto",
          contentClassName
        )}
      >
        {children}
      </CardContent>
    </Card>
  )
}
