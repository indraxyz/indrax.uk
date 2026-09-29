export type VisualVariant = "primary" | "secondary" | "tertiary" | "destructive" | "ghost"

export const variantClassNames = {
  primary: "variant-primary",
  secondary: "variant-secondary",
  tertiary: "variant-tertiary",
  destructive: "variant-destructive",
  ghost: "variant-ghost",
} satisfies Record<VisualVariant, string>

// The site's bordered control: a 2px box with the header's uppercase micro-type.
// Written out three times across the not-found page, the error boundary and the
// pagination before it was lifted here - it is a shape the design system owns, not
// a string each page should carry its own copy of.
export const controlClassNames =
  "flex items-center gap-2 border-2 border-border text-xs font-black uppercase tracking-[0.14em] transition-colors hover:bg-[var(--color-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
