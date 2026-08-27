import type { Metadata } from "next"
import { JetBrains_Mono } from "next/font/google"

import { DEFAULT_THEME, THEME_STORAGE_KEY } from "@/lib/theme"
import "./globals.css"

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
})

export const metadata: Metadata = {
  title: "Indra Cahya Edytya - Software Engineer",
  description:
    "Indra Cahya Edytya — full-stack software engineer with 9+ years across TypeScript, React, Next.js, backend APIs, cloud deployment, testing, and AI automation.",
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
      <body className="min-h-screen bg-background font-sans antialiased">{children}</body>
    </html>
  )
}
