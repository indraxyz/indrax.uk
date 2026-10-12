import { queryOptions } from "@tanstack/react-query"
import { adminApi, adminKeys } from "./client"

/** Shared by route loaders and session observers; APIs authorize every request. */
export const adminSessionOptions = queryOptions({
  queryKey: adminKeys.session,
  queryFn: ({ signal }) => adminApi.session(signal),
  staleTime: 60_000,
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
})
