import * as React from "react"

import { cn } from "@/lib/utils"

export type CardVariant = "card" | "ghost"
export type CardHeight = "auto" | "sm" | "md" | "lg" | "full"

const cardVariantClasses: Record<CardVariant, string> = {
  card: "rounded-none border-2 border-border bg-card shadow-soft",
  ghost: "rounded-none border-0 bg-transparent p-0 shadow-none",
}

const cardHeightClasses: Record<CardHeight, string> = {
  auto: "",
  sm: "min-h-40 max-h-64",
  md: "min-h-64 max-h-96",
  lg: "min-h-96 max-h-[40rem]",
  full: "h-full",
}

interface CardPartProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant
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

const CardHeader = React.forwardRef<
  HTMLDivElement,
  CardPartProps
>(({ className, variant, ...props }, ref) => {
  const resolvedVariant = variant ?? "card"

  return (
    <div
      ref={ref}
      className={cn(
        "flex flex-col space-y-1.5",
        resolvedVariant === "card" ? "p-6" : "p-0",
        className
      )}
      {...props}
    />
  )
})
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-2xl font-black uppercase leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  CardPartProps
>(({ className, variant, ...props }, ref) => {
  const resolvedVariant = variant ?? "card"

  return (
    <div
      ref={ref}
      className={cn(resolvedVariant === "card" ? "p-6 pt-0" : "p-0", className)}
      {...props}
    />
  )
})
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  CardPartProps
>(({ className, variant, ...props }, ref) => {
  const resolvedVariant = variant ?? "card"

  return (
    <div
      ref={ref}
      className={cn(
        "flex items-center",
        resolvedVariant === "card" ? "p-6 pt-0" : "p-0",
        className
      )}
      {...props}
    />
  )
})
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
