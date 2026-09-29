import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { ImageResponse } from "next/og"

import { SITE_HOST } from "@/features/resume/config"
import { personalInfo } from "@/features/resume/data/resume"
import { loadBrandFonts } from "@/lib/og/brand-fonts"
import { OG_CARD_CONTENT_TYPE, OG_CARD_SIZE, OG_COLORS } from "@/lib/og/brand"

export const SOCIAL_CARD_SIZE = OG_CARD_SIZE
export const SOCIAL_CARD_CONTENT_TYPE = OG_CARD_CONTENT_TYPE
export const SOCIAL_CARD_ALT = `${personalInfo.name} - ${personalInfo.title}`

// The banner is a fixed 1200x630, so the copy is sized against a known width rather
// than left to wrap: two skills is what fits beside the photo at a legible size.
const SKILLS_ON_CARD = 2

async function loadAssets() {
  const [fonts, photo] = await Promise.all([
    loadBrandFonts(),
    readFile(join(process.cwd(), "public", "foto-profile.jpg")),
  ])

  return {
    ...fonts,
    // Satori has no network and no public path; the photo has to travel inline.
    photoSrc: `data:image/jpeg;base64,${photo.toString("base64")}`,
  }
}

/**
 * The banner shown when a link to this site is unfurled - in a Slack channel, on
 * LinkedIn, in a WhatsApp preview.
 *
 * Rendered through `app/opengraph-image.tsx`, whose filename is a Next.js metadata
 * convention rather than a choice. The route is prerendered, so the reads above
 * happen during `next build`, where `public/` is certain to exist.
 */
export async function renderSocialCard() {
  const { regular, extraBold, photoSrc } = await loadAssets()
  const skills = (personalInfo.highlightSkills ?? []).slice(0, SKILLS_ON_CARD)

  return new ImageResponse(
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
      <div style={{ display: "flex", width: 180, height: 12, backgroundColor: OG_COLORS.accent }} />

      <div style={{ display: "flex", alignItems: "center", gap: 48 }}>
        {/* Satori draws this card, not a browser: `next/image` has no runtime here
            and the optimiser the rule points at does not exist. The source is an
            inline data URI, so there is nothing to lazy-load either. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photoSrc}
          width={220}
          height={220}
          alt=""
          style={{ objectFit: "cover", border: `8px solid ${OG_COLORS.accent}` }}
        />

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              display: "flex",
              fontSize: 60,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: -1,
              textTransform: "uppercase",
            }}
          >
            {personalInfo.name}
          </div>

          <div
            style={{
              display: "flex",
              fontSize: 24,
              fontWeight: 800,
              letterSpacing: 5,
              color: OG_COLORS.accent,
              textTransform: "uppercase",
            }}
          >
            {personalInfo.title}
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            {skills.map((skill) => (
              <div
                key={skill}
                style={{
                  display: "flex",
                  fontSize: 15,
                  padding: "8px 16px",
                  border: `3px solid ${OG_COLORS.accent}`,
                }}
              >
                {skill}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderTop: `4px solid ${OG_COLORS.accent}`,
          paddingTop: 24,
        }}
      >
        <div style={{ display: "flex", fontSize: 26, fontWeight: 800, letterSpacing: 3 }}>
          {SITE_HOST}
        </div>
        <div style={{ display: "flex", fontSize: 20, letterSpacing: 3, color: OG_COLORS.accent }}>
          RESUME / CV
        </div>
      </div>
    </div>,
    {
      ...SOCIAL_CARD_SIZE,
      fonts: [
        { name: "JetBrains Mono", data: regular, weight: 400, style: "normal" },
        { name: "JetBrains Mono", data: extraBold, weight: 800, style: "normal" },
      ],
    }
  )
}
