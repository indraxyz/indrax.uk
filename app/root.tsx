import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
  useRouteError,
} from "react-router"
import type { ReactNode } from "react"
import { QueryProvider } from "@/components/query-provider"
import { NavigationProgress } from "@/components/navigation-progress"
import { ConsentBanner } from "@/components/consent-banner"
import { PostHogAnalytics } from "@/components/posthog-analytics"
import { SiteErrorPage } from "@/components/site-error-page"
import { THEME_INIT_SCRIPT } from "@/lib/theme"
import "./globals.css"

export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.svg" />
        <link
          rel="alternate"
          type="application/rss+xml"
          title="Indra’s Writing"
          href="/writing/rss.xml"
        />
        <Meta />
        <Links />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}
export default function App() {
  return (
    <QueryProvider>
      <NavigationProgress />
      <Outlet />
      <ConsentBanner />
      <PostHogAnalytics />
    </QueryProvider>
  )
}
export function ErrorBoundary() {
  const error = useRouteError()
  const status = isRouteErrorResponse(error) ? error.status : 500
  return <SiteErrorPage status={status} />
}
