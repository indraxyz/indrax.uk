import { Check, Minus } from "lucide-react"
import { forwardRef, type ComponentProps } from "react"
import { focusControlClassNames } from "@/components/ui/variants"
import { cn } from "@/lib/utils"

/** Native checkbox semantics with theme tokens; the OS draws high-contrast controls. */
const Checkbox = forwardRef<HTMLInputElement, Omit<ComponentProps<"input">, "type">>(
  ({ className, ...props }, ref) => (
    <span className="relative inline-flex size-5 shrink-0">
      <input
        {...props}
        ref={ref}
        type="checkbox"
        data-slot="checkbox"
        className={cn(
          "peer size-5 shrink-0 appearance-none rounded-none border-2 border-input bg-background accent-primary checked:border-primary checked:bg-primary indeterminate:border-primary indeterminate:bg-primary enabled:cursor-pointer enabled:hover:border-primary disabled:cursor-not-allowed disabled:opacity-50 forced-colors:appearance-auto forced-colors:focus-visible:outline-2 forced-colors:focus-visible:outline-offset-2 forced-colors:focus-visible:outline-solid",
          focusControlClassNames,
          className
        )}
      />
      <Check
        aria-hidden
        strokeWidth={3}
        className="pointer-events-none absolute inset-0 hidden size-5 p-0.5 text-primary-foreground peer-checked:block peer-indeterminate:hidden peer-disabled:opacity-50 forced-colors:hidden!"
      />
      <Minus
        aria-hidden
        strokeWidth={3}
        className="pointer-events-none absolute inset-0 hidden size-5 p-0.5 text-primary-foreground peer-indeterminate:block peer-disabled:opacity-50 forced-colors:hidden!"
      />
    </span>
  )
)
Checkbox.displayName = "Checkbox"

export { Checkbox }
