import type { NextConfig } from "next"

// Applied to every response. These four are cheap, have no configuration surface,
// and none of them can break a page - which is exactly why there is no reason for
// a site serving database-authored HTML not to have them (PRD 4, "Transport &
// headers").
//
// A Content-Security-Policy is deliberately NOT here. `app/layout.tsx` injects an
// inline theme script, so a strict policy needs a per-request nonce, which needs
// middleware - and getting that wrong ships a site with no styling or no theme.
// It lands with the authoring phase, which introduces middleware anyway (T-12).
const SECURITY_HEADERS = [
  // A year, and preload-eligible. Only meaningful over HTTPS, ignored otherwise.
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  // Stops a browser second-guessing a Content-Type. The feed and the OG cards both
  // depend on theirs being believed.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Send the full URL to ourselves, the origin only to anyone else.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Nothing here is meant to be framed; until there is a CSP with frame-ancestors,
  // this is the header that says so.
  { key: "X-Frame-Options", value: "DENY" },
]

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }]
  },

  // The social card reads its fonts and the photo off disk. It is prerendered
  // during `next build`, where `public/` is certain to exist, but tracing the
  // files explicitly keeps the route working if it is ever made dynamic.
  outputFileTracingIncludes: {
    "/opengraph-image": ["./public/fonts/**", "./public/foto-profile.jpg"],
    // Article cards are drawn per post, so unlike the resume card they cannot all
    // be prerendered - a post published after the last deploy renders its card on
    // demand. Tracing the fonts keeps that path working wherever it runs.
    "/blog/[slug]/opengraph-image": ["./public/fonts/**"],
  },
}

export default nextConfig
