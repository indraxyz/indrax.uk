import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-none border-2 border-border text-sm font-black uppercase tracking-[0.14em] text-foreground ring-offset-background transition-transform duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0 active:translate-x-[3px] active:translate-y-[3px] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "variant-primary border-[var(--semantic-border-strong)] bg-[var(--variant-bg)] text-[var(--variant-fg)] shadow-soft-sm hover:-translate-x-[2px] hover:-translate-y-[2px] hover:bg-[var(--variant-hover)]",
        secondary:
          "variant-secondary border-[var(--semantic-border-strong)] bg-[var(--variant-bg)] text-[var(--variant-fg)] shadow-soft-sm hover:-translate-x-[2px] hover:-translate-y-[2px] hover:bg-[var(--variant-hover)]",
        tertiary:
          "variant-tertiary border-[var(--semantic-border-strong)] bg-[var(--variant-bg)] text-[var(--variant-fg)] shadow-soft-sm hover:-translate-x-[2px] hover:-translate-y-[2px] hover:bg-[var(--variant-hover)]",
        destructive:
          "variant-destructive border-[var(--semantic-border-strong)] bg-[var(--variant-bg)] text-[var(--variant-fg)] shadow-soft-sm hover:-translate-x-[2px] hover:-translate-y-[2px] hover:bg-[var(--variant-hover)]",
        ghost:
          "variant-ghost border-transparent bg-[var(--variant-bg)] text-[var(--variant-fg)] shadow-none hover:border-border hover:bg-[var(--variant-hover)]",
      },
      size: {
        default: "h-11 px-5 py-2",
        sm: "h-9 px-3",
        lg: "h-12 px-8",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
