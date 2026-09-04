import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { ImageResponse } from "next/og"

import { SITE_URL } from "@/features/resume/config"
import { personalInfo } from "@/features/resume/data/resume"

export const OG_SIZE = { width: 1200, height: 630 }
export const OG_CONTENT_TYPE = "image/png"
export const OG_ALT = `${personalInfo.name} - ${personalInfo.title}`

const PUBLIC_DIR = join(process.cwd(), "public")
const SITE_HOST = new URL(SITE_URL).host

// The page's own tokens, so a shared link and the site it points at read as one
// product rather than two. Mirrors `--primitive-brand-950` / `--primitive-brand-300`
// in `app/globals.css`.
const COLORS = {
  background: "#063b00",
  foreground: "#ffffff",
  accent: "#e1e100",
} as const

// The banner is a fixed 1200x630, so the copy is sized against a known width rather
// than left to wrap: two skills is what fits beside the photo at a legible size.
const SKILLS_ON_CARD = 2

async function loadAssets() {
  const [regular, extraBold, photo] = await Promise.all([
    readFile(join(PUBLIC_DIR, "fonts", "JetBrainsMono-Regular.ttf")),
    readFile(join(PUBLIC_DIR, "fonts", "JetBrainsMono-ExtraBold.ttf")),
    readFile(join(PUBLIC_DIR, "foto-profile.jpg")),
  ])

  return {
    regular,
    extraBold,
    // Satori has no network and no public path; the photo has to travel inline.
    photoSrc: `data:image/jpeg;base64,${photo.toString("base64")}`,
  }
}

/**
 * The card behind `/opengraph-image` and `/twitter-image`.
 *
 * Both routes are prerendered, so the reads above happen during `next build` where
 * `public/` is certain to exist.
 */
export async function renderProfileCard() {
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
        backgroundColor: COLORS.background,
        color: COLORS.foreground,
        fontFamily: "JetBrains Mono",
      }}
    >
      <div style={{ display: "flex", width: 180, height: 12, backgroundColor: COLORS.accent }} />

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
          style={{ objectFit: "cover", border: `8px solid ${COLORS.accent}` }}
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
              color: COLORS.accent,
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
                  border: `3px solid ${COLORS.accent}`,
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
          borderTop: `4px solid ${COLORS.accent}`,
          paddingTop: 24,
        }}
      >
        <div style={{ display: "flex", fontSize: 26, fontWeight: 800, letterSpacing: 3 }}>
          {SITE_HOST}
        </div>
        <div style={{ display: "flex", fontSize: 20, letterSpacing: 3, color: COLORS.accent }}>
          RESUME / CV
        </div>
      </div>
    </div>,
    {
      ...OG_SIZE,
      fonts: [
        { name: "JetBrains Mono", data: regular, weight: 400, style: "normal" },
        { name: "JetBrains Mono", data: extraBold, weight: 800, style: "normal" },
      ],
    }
  )
}
