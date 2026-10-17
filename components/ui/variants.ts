export type VisualVariant = "primary" | "secondary" | "tertiary" | "destructive" | "ghost"

export const variantClassNames = {
  primary: "variant-primary",
  secondary: "variant-secondary",
  tertiary: "variant-tertiary",
  destructive: "variant-destructive",
  ghost: "variant-ghost",
} satisfies Record<VisualVariant, string>

// Fields and actions share the filter sheet's focus treatment without a gap.
export const focusControlClassNames =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

export const fieldClassNames = `min-h-11 w-full border-2 border-border bg-background px-3 py-2 text-sm text-foreground ${focusControlClassNames}`

// The site's bordered control: a 2px box with the header's uppercase micro-type.
// Written out three times across the not-found page, the error boundary and the
// pagination before it was lifted here - it is a shape the design system owns, not
// a string each page should carry its own copy of.
export const controlClassNames = `flex items-center gap-2 border-2 border-border text-xs font-black uppercase tracking-[0.14em] transition-colors hover:bg-[var(--color-muted)] ${focusControlClassNames}`

export const loadingIndicatorClassNames =
  "inline-flex shrink-0 items-center justify-center animate-spin motion-reduce:animate-none"

export const loadingIndicatorSizes = {
  sm: { container: "size-5" },
  lg: { container: "size-12" },
} as const
