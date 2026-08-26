import { variantClassNames, type VisualVariant } from "@/components/ui/variants"
import { cn } from "@/lib/utils"
import { ExternalLink } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"

export interface SectionLink {
  href: string
  textLink: string
}

export type SectionHeaderSize = "sm" | "lg"

const titleSizeClasses: Record<SectionHeaderSize, string> = {
  sm: "text-xl",
  lg: "text-2xl",
}

interface SectionHeaderProps {
  icon: ReactNode
  title: string
  subtitle?: string
  tone?: VisualVariant
  size?: SectionHeaderSize
  link?: SectionLink
}

export function SectionHeader({
  icon,
  title,
  subtitle,
  tone = "primary",
  size = "sm",
  link,
}: SectionHeaderProps) {
  const hasDetails = Boolean(subtitle || link)

  return (
    <div className={cn("flex gap-3", hasDetails ? "items-start" : "items-center")}>
      <div
        className={cn(
          "variant-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-none border-2",
          variantClassNames[tone]
        )}
      >
        {icon}
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className={cn("font-black uppercase tracking-tight", titleSizeClasses[size])}>
          {title}
        </h2>
        {subtitle && (
          <p className="max-w-3xl text-sm font-semibold leading-relaxed text-current opacity-85">
            {subtitle}
          </p>
        )}
        {link && (
          <Link
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.14em] text-current opacity-85 transition hover:opacity-100 hover:underline"
          >
            {link.textLink} <ExternalLink className="h-4 w-4" />
          </Link>
        )}
      </div>
    </div>
  )
}
