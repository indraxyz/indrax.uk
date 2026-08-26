export type VisualVariant = "primary" | "secondary" | "tertiary" | "destructive" | "ghost"

export const variantClassNames = {
  primary: "variant-primary",
  secondary: "variant-secondary",
  tertiary: "variant-tertiary",
  destructive: "variant-destructive",
  ghost: "variant-ghost",
} satisfies Record<VisualVariant, string>
