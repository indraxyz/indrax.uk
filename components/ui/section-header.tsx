import { variantClassNames, type VisualVariant } from "@/components/ui/variants"
import { cn } from "@/lib/utils"
import { ArrowRight, ExternalLink } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"

export interface SectionLink {
  href: string
  textLink: string
}

// Every section link pointed off-site until the blog arrived, so opening a new tab
// was unconditional. It cannot stay that way: a same-site link that steals a tab
// is a nuisance, and the external-link icon beside it would be a lie.
const isExternal = (href: string) => /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("//")

export type SectionHeaderSize = "sm" | "lg"

// Every section on the resume sits under the hero's h1, so h2 is the right default
// and stays it. The blog's list and tag pages have no hero: their section header is
// the page's only top-level heading, and a page without an h1 is flagged by axe and
// leaves anyone navigating by heading with no entry point.
export type SectionHeadingLevel = 1 | 2

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
  headingLevel?: SectionHeadingLevel
  link?: SectionLink
}

export function SectionHeader({
  icon,
  title,
  subtitle,
  tone = "primary",
  size = "sm",
  headingLevel = 2,
  link,
}: SectionHeaderProps) {
  const hasDetails = Boolean(subtitle || link)
  // Only the level changes; the type stays whatever `size` says, so promoting a
  // header to h1 does not also resize it.
  const Heading = headingLevel === 1 ? "h1" : "h2"

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
        <Heading className={cn("font-black uppercase tracking-tight", titleSizeClasses[size])}>
          {title}
        </Heading>
        {subtitle && (
          <p className="max-w-5xl text-sm font-semibold leading-relaxed text-current opacity-85">
            {subtitle}
          </p>
        )}
        {link && (
          <Link
            href={link.href}
            {...(isExternal(link.href) ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.14em] text-current opacity-85 transition hover:opacity-100 hover:underline"
          >
            {link.textLink}
            {isExternal(link.href) ? (
              <ExternalLink className="h-4 w-4" aria-hidden />
            ) : (
              <ArrowRight className="h-4 w-4" aria-hidden />
            )}
          </Link>
        )}
      </div>
    </div>
  )
}
