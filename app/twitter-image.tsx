import {
  OG_ALT,
  OG_CONTENT_TYPE,
  OG_SIZE,
  renderProfileCard,
} from "@/features/resume/og/profile-card"

// Same card as the Open Graph one. It lives in its own file because Next resolves
// each social image by filename convention, and re-exporting a default across the
// two conventions is easy to break by accident.
export const alt = OG_ALT
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

export default function TwitterImage() {
  return renderProfileCard()
}
