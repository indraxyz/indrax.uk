import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState, type ReactNode } from "react"

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        retry: false,
        retryOnMount: false,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  })
}

let browserClient: QueryClient | undefined

/** Route loaders and components share the browser cache; SSR never shares it. */
export function getBrowserQueryClient() {
  if (typeof window === "undefined") throw new Error("Browser query cache is client-only")
  return (browserClient ??= createQueryClient())
}

/** Each SSR request and each browser application owns its own cache. */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() =>
    typeof window === "undefined" ? createQueryClient() : getBrowserQueryClient()
  )
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
