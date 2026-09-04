import { join } from "node:path"

import { Font, StyleSheet } from "@react-pdf/renderer"

/**
 * The PDF is drawn by react-pdf's own layout engine, which shares nothing with
 * the site's stylesheet. These values are the light theme's computed colours,
 * read straight off the rendered page, so the two stay in step.
 */
export const pdfColors = {
  page: "#ffffff",
  text: "#152111",
  textMuted: "#394635",
  border: "#063b00",
  primaryBg: "#063b00",
  primaryFg: "#ffffff",
  primarySoft: "#dfe6de",
  secondaryBg: "#266210",
  secondaryFg: "#ffffff",
  secondarySoft: "#dfe8dd",
  tertiaryBg: "#e1e100",
  tertiaryFg: "#063b00",
  tertiaryBorder: "#b4bd00",
  tertiarySoft: "#f4f6c4",
} as const

// Self-hosted rather than pulled from a CDN, so the download works offline and
// cannot break when a font host changes a URL.
//
// react-pdf picks how to load a font from the shape of `src`: a data URL is
// decoded, an http(s) URL is fetched, and anything else is handed to
// `fontkit.open()` as a path on disk. The document is rendered on the server now,
// where there is no origin for a bare "/fonts/..." to resolve against, so the
// sources have to be real filesystem paths.
const PUBLIC_DIR = join(process.cwd(), "public")
const FONT_DIR = join(PUBLIC_DIR, "fonts")

// `Image` sources resolve exactly the same way, so the hero photo has to be a path
// on disk too. Left as "/foto-profile.jpg" it silently renders nothing: react-pdf
// logs the ENOENT and draws the rest of the document without it, so the CV loses
// its photo without anything failing.
export const PDF_PHOTO_SRC = join(PUBLIC_DIR, "foto-profile.jpg")

let registered = false

export function registerPdfFonts() {
  if (registered) return
  registered = true

  Font.register({
    family: "JetBrains Mono",
    fonts: [
      { src: join(FONT_DIR, "JetBrainsMono-Regular.ttf"), fontWeight: 400 },
      { src: join(FONT_DIR, "JetBrainsMono-Bold.ttf"), fontWeight: 700 },
      { src: join(FONT_DIR, "JetBrainsMono-ExtraBold.ttf"), fontWeight: 800 },
    ],
  })

  // The engine will not hyphenate a monospace resume sensibly; let words wrap whole.
  Font.registerHyphenationCallback((word) => [word])
}

export const styles = StyleSheet.create({
  page: {
    backgroundColor: pdfColors.page,
    color: pdfColors.text,
    fontFamily: "JetBrains Mono",
    fontSize: 7,
    lineHeight: 1.45,
    paddingTop: 24,
    paddingBottom: 30,
    paddingHorizontal: 24,
  },

  card: { borderWidth: 1.5, borderColor: pdfColors.border, marginBottom: 10 },
  cardHeader: {
    borderBottomWidth: 1.5,
    borderBottomColor: pdfColors.border,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  cardBody: { padding: 8 },

  sectionTitle: { fontSize: 11, lineHeight: 1.25, fontWeight: 800, letterSpacing: 0.6 },
  sectionSubtitle: { fontSize: 6.5, lineHeight: 1.35, fontWeight: 700, marginTop: 2 },

  hero: { flexDirection: "row", gap: 10 },
  heroPhoto: {
    width: 72,
    borderWidth: 1.5,
    borderColor: pdfColors.border,
    objectFit: "cover",
  },
  heroName: { fontSize: 20, lineHeight: 1.15, fontWeight: 800, letterSpacing: 0.5 },
  heroRole: {
    fontSize: 7.5,
    lineHeight: 1.3,
    fontWeight: 800,
    letterSpacing: 1.2,
    color: pdfColors.primaryBg,
  },
  heroBio: { fontSize: 7.5, lineHeight: 1.4, marginTop: 6 },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 3, marginTop: 5 },
  chip: {
    lineHeight: 1.3,
    borderWidth: 1,
    borderColor: pdfColors.border,
    paddingVertical: 1.5,
    paddingHorizontal: 3,
    fontSize: 5.5,
    fontWeight: 800,
    letterSpacing: 0.5,
  },
  chipPrimary: { backgroundColor: pdfColors.primarySoft },
  chipTertiary: { backgroundColor: pdfColors.tertiarySoft, borderColor: pdfColors.tertiaryBorder },

  badge: {
    lineHeight: 1.3,
    paddingVertical: 1.5,
    paddingHorizontal: 3,
    fontSize: 5.5,
    fontWeight: 800,
    letterSpacing: 0.5,
    color: pdfColors.secondaryFg,
    backgroundColor: pdfColors.secondaryBg,
  },

  columns: { flexDirection: "row", gap: 10 },
  column: { flex: 1 },

  itemTitle: { fontSize: 7.5, lineHeight: 1.35, fontWeight: 700 },
  itemMeta: { fontSize: 6.5, lineHeight: 1.35, color: pdfColors.textMuted },
  link: {
    fontSize: 6.5,
    lineHeight: 1.35,
    color: pdfColors.secondaryBg,
    textDecoration: "underline",
  },

  groupLabel: { fontSize: 6.5, fontWeight: 800, letterSpacing: 0.8, marginBottom: 3 },

  bullet: { flexDirection: "row", gap: 4, marginBottom: 2.5 },
  bulletMark: { width: 3, marginTop: 3, height: 3, backgroundColor: pdfColors.secondaryBg },
  bulletText: { flex: 1 },

  divider: { borderTopWidth: 1, borderTopColor: pdfColors.tertiaryBorder, marginVertical: 5 },

  footer: {
    marginTop: 4,
    textAlign: "center",
    fontSize: 6,
    fontWeight: 800,
    letterSpacing: 1,
    lineHeight: 1.3,
    color: pdfColors.textMuted,
    borderTopWidth: 1.5,
    borderTopColor: pdfColors.border,
    paddingTop: 5,
  },
})
