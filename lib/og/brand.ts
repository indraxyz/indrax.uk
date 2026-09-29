/**
 * The palette the server-drawn cards use.
 *
 * Satori has no CSS custom properties, so the tokens in `app/globals.css` cannot
 * reach it and the values have to be literal here. One copy, imported by both
 * cards: two copies of a hardcoded hex is exactly the drift the rest of the
 * codebase is built to avoid.
 *
 * Mirrors `--primitive-brand-950`, `--primitive-neutral-0` and
 * `--primitive-brand-300`. If those change, change these.
 */
export const OG_COLORS = {
  background: "#063b00",
  foreground: "#ffffff",
  accent: "#e1e100",
} as const

export const OG_CARD_SIZE = { width: 1200, height: 630 } as const
export const OG_CARD_CONTENT_TYPE = "image/png"
