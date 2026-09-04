import type { Metadata } from "next"
import { JetBrains_Mono } from "next/font/google"

import { PostHogAnalytics } from "@/components/analytics/posthog-analytics"
import { RESUME_CONFIG, SITE_URL } from "@/features/resume/config"
import { personalInfo } from "@/features/resume/data/resume"
import { DEFAULT_THEME, THEME_STORAGE_KEY } from "@/lib/theme"
import "./globals.css"

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
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
    <html lang="en" className={jetBrainsMono.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
        <PostHogAnalytics />
      </body>
    </html>
  )
}
