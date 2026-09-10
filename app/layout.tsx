import type { Metadata } from "next"
import { Inter, JetBrains_Mono } from "next/font/google"

import { ConsentBanner } from "@/components/consent-banner"
import { PostHogAnalytics } from "@/components/posthog-analytics"
import { BLOG_CONFIG } from "@/features/blog/config"
import { RESUME_CONFIG, SITE_URL } from "@/features/resume/config"
import { personalInfo } from "@/features/resume/data/resume"
import { DEFAULT_THEME, THEME_STORAGE_KEY } from "@/lib/theme"
import "./globals.css"

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
})

// Article bodies only - `.prose` is the sole consumer of `--font-prose`. The site
// chrome, the resume and every code block stay monospace, so this face is loaded
// for long-form reading and nothing else.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  // The variable is declared on <html> so `.prose` can reach it, which would
  // otherwise put a preload hint for this face on the resume page too - a page
  // that never renders a glyph of it. The @font-face still resolves; only the
  // eager fetch is dropped.
  preload: false,
})

const TITLE = "Indra Cahya Edytya - Software Engineer"
const DESCRIPTION =
  "Indra Cahya Edytya — full-stack software engineer with 9+ years across TypeScript, React, Next.js, backend APIs, cloud deployment, testing, and AI automation."

export const metadata: Metadata = {
  // Resolves the relative URLs below against the deployment, so shared links and
  // crawlers see absolute addresses rather than a bare path.
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: RESUME_CONFIG.title,
  authors: [{ name: personalInfo.name, url: SITE_URL }],
  creator: personalInfo.name,
  alternates: { canonical: "/" },
  keywords: [
    "Full-stack software engineer",
    "TypeScript",
    "React",
    "Next.js",
    "Node.js",
    "Backend APIs",
    "Cloud deployment",
    "AI automation",
  ],
  openGraph: {
    type: "profile",
    url: "/",
    siteName: RESUME_CONFIG.title,
    title: TITLE,
    description: DESCRIPTION,
    locale: "en_US",
  },
  twitter: {
    // The banner is 1200x630, so the large card is the one that shows it.
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
}

const themeScript = `
(() => {
  try {
    const storageKey = ${JSON.stringify(THEME_STORAGE_KEY)};
    const theme = localStorage.getItem(storageKey) || ${JSON.stringify(DEFAULT_THEME)};
    const systemTheme = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    const resolvedTheme = theme === "system" ? systemTheme : theme;

    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
    document.documentElement.dataset.theme = theme;
  } catch {
    document.documentElement.classList.remove("dark");
    document.documentElement.dataset.theme = ${JSON.stringify(DEFAULT_THEME)};
  }
})();
`

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${jetBrainsMono.variable} ${inter.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Written here rather than through `metadata.alternates.types`, because a
            route that declares its own canonical replaces the whole `alternates`
            object and would drop the feed with it. Every page needs to advertise
            it, so it belongs somewhere a page cannot override. */}
        <link
          rel="alternate"
          type="application/rss+xml"
          title={BLOG_CONFIG.feedTitle}
          href={BLOG_CONFIG.feedPath}
        />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
        <ConsentBanner />
        <PostHogAnalytics />
      </body>
    </html>
  )
}
