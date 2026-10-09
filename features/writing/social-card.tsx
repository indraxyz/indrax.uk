import { CustomFont, ImageResponse } from "cf-workers-og"

import { WRITING_CONFIG } from "@/features/writing/config"
import type { Post } from "@/features/writing/types"
import { SITE_HOST } from "@/features/resume/config"
import { personalInfo } from "@/features/resume/data/resume"
import { loadBrandFonts } from "@/lib/og/brand-fonts"
import { OG_CARD_CONTENT_TYPE, OG_CARD_SIZE, OG_COLORS } from "@/lib/og/brand"

export const POST_CARD_SIZE = OG_CARD_SIZE
export const POST_CARD_CONTENT_TYPE = OG_CARD_CONTENT_TYPE

// Satori does not reflow to fit, so a long title is cut here rather than allowed
// to overflow the canvas. Sized against 1200px at 58px: four lines is what fits
// above the footer rule (PRD US-5.3).
const TITLE_LIMIT = 110

const truncate = (value: string, limit: number) =>
  value.length <= limit ? value : `${value.slice(0, limit - 1).trimEnd()}...`

const TAGS_ON_CARD = 3

/**
 * The banner shown when an article link is unfurled.
 *
 * Served by the `/writing/:slug/opengraph-image` Worker resource. Article route
 * metadata references this card for both Open Graph and Twitter images.
 */
export async function renderPostCard(post: Post) {
  const { regular, extraBold } = await loadBrandFonts()
  const tags = post.tags.slice(0, TAGS_ON_CARD)

  return ImageResponse.create(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 60,
        backgroundColor: OG_COLORS.background,
        color: OG_COLORS.foreground,
        fontFamily: "JetBrains Mono",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        <div
          style={{ display: "flex", width: 180, height: 12, backgroundColor: OG_COLORS.accent }}
        />

        <div
          style={{
            display: "flex",
            fontSize: 20,
            fontWeight: 800,
            letterSpacing: 6,
            color: OG_COLORS.accent,
            textTransform: "uppercase",
          }}
        >
          {WRITING_CONFIG.title}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          fontSize: 58,
          fontWeight: 800,
          lineHeight: 1.15,
          letterSpacing: -1,
        }}
      >
        {truncate(post.title, TITLE_LIMIT)}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        {tags.length > 0 && (
          <div style={{ display: "flex", gap: 12 }}>
            {tags.map((tag) => (
              <div
                key={tag.id}
                style={{
                  display: "flex",
                  fontSize: 16,
                  padding: "8px 16px",
                  border: `3px solid ${OG_COLORS.accent}`,
                }}
              >
                {tag.name}
              </div>
            ))}
          </div>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: `4px solid ${OG_COLORS.accent}`,
            paddingTop: 24,
          }}
        >
          <div style={{ display: "flex", fontSize: 24, fontWeight: 800, letterSpacing: 2 }}>
            {personalInfo.name}
          </div>
          <div style={{ display: "flex", fontSize: 20, letterSpacing: 3, color: OG_COLORS.accent }}>
            {SITE_HOST}
          </div>
        </div>
      </div>
    </div>,
    {
      ...POST_CARD_SIZE,
      fonts: [
        new CustomFont("JetBrains Mono", regular, { weight: 400 }),
        new CustomFont("JetBrains Mono", extraBold, { weight: 800 }),
      ],
    }
  )
}
