import type { NextConfig } from "next"

// Applied to every response. These four are cheap, have no configuration surface,
// and none of them can break a page - which is exactly why there is no reason for
// a site serving database-authored HTML not to have them (PRD 4, "Transport &
// headers").
//
// The Content-Security-Policy below is partial, and the omission is deliberate.
//
// `script-src` and `style-src` are absent. Next inlines its own bootstrap and RSC
// payload into `<script>` tags, and `app/layout.tsx` inlines a theme script that
// has to run before first paint - so any useful `script-src` needs a per-request
// nonce. A nonce needs middleware, and a nonce cannot be baked into a prerendered
// page: adding one would turn every article dynamic, which is the same trade
// already refused for the draft preview. Hashing the theme script alone does not
// help, because Next's own inline scripts would still be blocked.
//
// So what is here is every directive that costs nothing and needs no nonce.
// `frame-ancestors` closes the clickjacking half of T-12 and the hardening
// checklist's `frame-ancestors 'none'` item; `base-uri` stops an injected `<base>`
// repointing every relative URL on the page; `object-src` and `form-action` shut
// two surfaces this site has no use for. The rest waits for a nonce strategy
// worth its cost.
const CONTENT_SECURITY_POLICY = [
  // No `default-src`, deliberately. It is the fallback for every directive not
  // listed - including `script-src` - so setting it to `'self'` would block Next's
  // own inline bootstrap and the theme script, and the site would render unstyled
  // and unthemed. Omitting it leaves the unlisted directives unrestricted, which
  // is the honest state of things until there is a nonce.
  //
  // Nothing here is meant to be framed, by anyone. Supersedes X-Frame-Options in
  // browsers that honour both.
  "frame-ancestors 'none'",
  // Relative URLs resolve against this document and nowhere else.
  "base-uri 'none'",
  // No plugins, no <object>, no <embed>.
  "object-src 'none'",
  // The only form on the site posts to the site.
  "form-action 'self'",
  // Covers the resume photo, the generated cards, and cover images from the one
  // configured media origin. `data:` is for the inline photo the OG card embeds.
  "img-src 'self' data: https:",
  // Fonts come from the deployment itself; next/font self-hosts Google's.
  "font-src 'self'",
  // Costs nothing on a site already served over HTTPS, and closes the gap on any
  // stray http:// subresource an article might one day carry.
  "upgrade-insecure-requests",
].join("; ")

const SECURITY_HEADERS = [
  // A year, and preload-eligible. Only meaningful over HTTPS, ignored otherwise.
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  // Stops a browser second-guessing a Content-Type. The feed and the OG cards both
  // depend on theirs being believed.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Send the full URL to ourselves, the origin only to anyone else.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Kept alongside `frame-ancestors` for browsers that honour only this one.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
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
