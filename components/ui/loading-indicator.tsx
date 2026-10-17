import type { ComponentProps } from "react"
import spinnerSvg from "@/components/ui/loading-spinner.svg?raw"

import { loadingIndicatorClassNames, loadingIndicatorSizes } from "@/components/ui/variants"
import { cn } from "@/lib/utils"

/** Inherits text color, including a parent button's variant and disabled state. */
export function LoadingIndicator({
  className,
  size = "sm",
  ...props
}: Omit<ComponentProps<"span">, "children" | "dangerouslySetInnerHTML"> & { size?: "sm" | "lg" }) {
  return (
    <span
      aria-hidden="true"
      data-slot="loading-indicator"
      className={cn(loadingIndicatorClassNames, loadingIndicatorSizes[size].container, className)}
      // This is a trusted local vector asset, inlined so currentColor follows its parent.
      dangerouslySetInnerHTML={{ __html: spinnerSvg }}
      {...props}
    />
  )
}
