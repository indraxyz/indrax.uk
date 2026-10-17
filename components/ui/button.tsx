import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { focusControlClassNames } from "@/components/ui/variants"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  `inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-none border-2 text-sm font-black uppercase tracking-[0.14em] transition-colors duration-150 ease-out ${focusControlClassNames} disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none [&_svg]:pointer-events-none [&_:where(svg:not([data-loading-icon]))]:size-4 [&_svg]:shrink-0`,
  {
    variants: {
      variant: {
        primary:
          "variant-primary border-[var(--semantic-border-strong)] bg-[var(--variant-bg)] text-[var(--variant-fg)] hover:bg-[var(--variant-hover)]",
        secondary:
          "variant-secondary border-[var(--semantic-border-strong)] bg-[var(--variant-bg)] text-[var(--variant-fg)] hover:bg-[var(--variant-hover)]",
        tertiary:
          "variant-tertiary border-[var(--semantic-border-strong)] bg-[var(--variant-bg)] text-[var(--variant-fg)] hover:bg-[var(--variant-hover)]",
        destructive:
          "variant-destructive border-[var(--semantic-border-strong)] bg-[var(--variant-bg)] text-[var(--variant-fg)] hover:bg-[var(--variant-hover)]",
        ghost:
          "variant-ghost border-transparent bg-[var(--variant-bg)] text-[var(--variant-fg)] shadow-none hover:border-border hover:bg-[var(--variant-hover)]",
      },
      appearance: {
        raised: "",
        flat: "shadow-none",
      },
      size: {
        default: "h-11 px-5 py-2",
        sm: "h-9 px-3",
        lg: "h-12 px-8",
        icon: "h-11 w-11",
      },
    },
    compoundVariants: [
      {
        variant: ["primary", "secondary", "tertiary", "destructive"],
        appearance: "raised",
        className: "shadow-soft-sm",
      },
    ],
    defaultVariants: {
      variant: "primary",
      appearance: "raised",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, appearance, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, appearance, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
