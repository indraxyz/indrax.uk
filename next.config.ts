import type { NextConfig } from "next"

import { POSTHOG_HOST } from "./lib/analytics-host"

// Applied to every response. These four are cheap, have no configuration surface,
// and none of them can break a page - which is exactly why there is no reason for
// a site serving database-authored HTML not to have them (PRD 4, "Transport &
// headers").
//
// The Content-Security-Policy below is partial, and the omission is deliberate.
//
// `script-src` is absent, and it is the one that would matter most. Next inlines
// its own bootstrap and the RSC payload into `<script>` tags, and
// `app/layout.tsx` inlines a theme script that has to run before first paint - so
// a useful `script-src` needs a per-request nonce. Hashing does not substitute:
// the RSC payload differs per page and per build, so there is no stable digest to
// list.
//
// A nonce has to come from middleware, and a nonce cannot be baked into a
// prerendered page - the HTML holds a per-request value, so Next renders the page
// on every request instead of serving a file. That was measured rather than
// assumed: an article body costs ~430ms of CPU to render on a cold isolate (Shiki
// loads its grammars and both themes) and ~40ms warm, against zero today, because
// today it is a static asset. On a per-request-billed runtime that converts the
// site's most linkable URLs into paid compute that anyone can invoke in a loop -
// which is threat T-11, denial of wallet, made materially worse in exchange for
// defence-in-depth behind a sanitiser that is itself the control for T-2 and has
// unit tests standing over it.
//
// So `script-src` stays out until either the render is cached per-URL behind the
// nonce or the site moves to a runtime where the trade reads differently. What is
// here is every directive that costs nothing: `frame-ancestors` closes the
// clickjacking half of T-12, `base-uri` stops an injected `<base>` repointing
// every relative URL, `connect-src` bounds where an injected script could send
// what it read, and the rest shut surfaces this site has no use for at all.
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
  // Where the page may send data. Without `script-src` this is the directive
  // doing the real work against T-2: an injected script still runs, but it can
  // only talk to this origin and the analytics endpoint, so it cannot post what
  // it scraped to a collector of its own. The host is the same constant the
  // tracker is pointed at, because a policy that disagrees with the client
  // blocks every event and looks like an outage rather than a typo.
  `connect-src 'self' ${POSTHOG_HOST}`,
  // Next inlines critical CSS, so `'unsafe-inline'` is unavoidable here - but
  // naming the directive still stops a stylesheet being pulled from anywhere
  // else, which is how injected CSS exfiltrates via selective background-image
  // requests.
  "style-src 'self' 'unsafe-inline'",
  // Nothing on this site frames anything. Closes the other direction from
  // `frame-ancestors`: an injected iframe is a standard phishing surface.
  "frame-src 'none'",
  // No audio or video anywhere.
  "media-src 'self'",
  // `blob:` because the analytics client builds its workers that way; without it
  // the tracker throws on start.
  "worker-src 'self' blob:",
  "manifest-src 'self'",
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
