import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // `/resume.pdf` is the address that gets pasted into application forms and
      // email signatures, so it has to be the public one. The handler cannot live
      // at `app/resume.pdf/route.tsx` though: .gitignore ends with `*.pdf`, and a
      // gitignore pattern matches directories as well as files, so that route
      // folder and everything inside it would be silently untracked.
      { source: "/resume.pdf", destination: "/api/resume-pdf" },
    ]
  },

  // fontkit and the rest of the PDF renderer are Node-native. Bundling them into
  // the server build breaks the font loader.
  serverExternalPackages: ["@react-pdf/renderer"],

  // The PDF and the social card both read their fonts off disk. Both are
  // prerendered during `next build`, where `public/` is certain to exist, but
  // tracing the files explicitly keeps the routes working if either is ever made
  // dynamic.
  outputFileTracingIncludes: {
    "/api/resume-pdf": ["./public/fonts/**", "./public/foto-profile.jpg"],
    "/opengraph-image": ["./public/fonts/**", "./public/foto-profile.jpg"],
  },
}

export default nextConfig
