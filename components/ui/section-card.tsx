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
  className,
  headerClassName,
  contentClassName,
}: SectionCardProps) {
  const isGhost = variant === "ghost"
  const isBounded = isBoundedHeight(height)

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
        scrollable={isBounded}
        className={cn(isGhost ? "py-6" : "pt-6", contentClassName)}
      >
        {children}
      </CardContent>
    </Card>
  )
}
