import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // The social card reads its fonts and the photo off disk. It is prerendered
  // during `next build`, where `public/` is certain to exist, but tracing the
  // files explicitly keeps the route working if it is ever made dynamic.
  outputFileTracingIncludes: {
    "/opengraph-image": ["./public/fonts/**", "./public/foto-profile.jpg"],
  },
}

export default nextConfig
