import * as React from "react"

import { cn } from "@/lib/utils"

export type CardVariant = "card" | "ghost"
export type CardHeight = "auto" | "sm" | "md" | "lg" | "xl" | "full"

const cardVariantClasses: Record<CardVariant, string> = {
  card: "rounded-none border-2 border-border bg-card shadow-soft",
  ghost: "rounded-none border-0 bg-transparent p-0 shadow-none",
}

const cardHeightClasses: Record<CardHeight, string> = {
  auto: "",
  sm: "flex flex-col min-h-40 max-h-64",
  md: "flex flex-col min-h-64 max-h-96",
  lg: "flex flex-col min-h-96 max-h-[40rem]",
  xl: "flex flex-col min-h-96 max-h-[1250px]",
  full: "flex flex-col h-full",
}

// A bounded card lays its parts out as a flex column: the header keeps its size and
// the content pane takes the remaining space and scrolls on its own.
export const isBoundedHeight = (height: CardHeight) => height !== "auto"

interface CardPartProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant
}

interface CardContentProps extends CardPartProps {
  // Fills the remaining space of a bounded card and scrolls, so children never
  // need a height cap of their own.
  scrollable?: boolean
}

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    variant?: CardVariant
    height?: CardHeight
  }
>(({ className, variant = "card", height = "auto", ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "text-card-foreground",
      cardVariantClasses[variant],
      cardHeightClasses[height],
      className
    )}
    {...props}
  />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<HTMLDivElement, CardPartProps>(
  ({ className, variant = "card", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex shrink-0 flex-col space-y-1.5",
          variant === "card" ? "p-6" : "p-0",
          className
        )}
        {...props}
      />
    )
  }
)
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn("text-2xl font-black uppercase leading-none tracking-tight", className)}
      {...props}
    />
  )
)
CardTitle.displayName = "CardTitle"

const CardContent = React.forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, variant = "card", scrollable = false, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          variant === "card" ? "p-6 pt-0" : "p-0",
          scrollable && "min-h-0 flex-1 overflow-y-auto",
          className
        )}
        {...props}
      />
    )
  }
)
CardContent.displayName = "CardContent"

export { Card, CardHeader, CardTitle, CardContent }
