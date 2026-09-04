import {
  renderSocialCard,
  SOCIAL_CARD_ALT,
  SOCIAL_CARD_CONTENT_TYPE,
  SOCIAL_CARD_SIZE,
} from "@/features/resume/social-card"

// The filename is a Next.js metadata convention, not a description of the contents:
// this route is what populates `og:image`. Next also derives `twitter:image` from
// it, so no separate `twitter-image` route is needed - the card itself is named for
// what it is, in `features/resume/social-card.tsx`.
export const alt = SOCIAL_CARD_ALT
export const size = SOCIAL_CARD_SIZE
export const contentType = SOCIAL_CARD_CONTENT_TYPE

export default function OpengraphImage() {
  return renderSocialCard()
}
