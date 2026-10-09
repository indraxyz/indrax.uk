import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState, type ReactNode } from "react"

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 60_000, retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  })
}

/** Each SSR request and each browser application owns its own cache. */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(createQueryClient)
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
