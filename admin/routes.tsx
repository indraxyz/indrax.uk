import { useEffect, useRef } from "react"
import { createBrowserRouter, Navigate, Outlet, useLocation } from "react-router"
import { useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query"
import { HTTPError } from "ky"
import { adminApi, adminKeys } from "@/features/writing/api/client"
import { AdminSessionContext, AdminLoading, AdminError } from "./shared"
import { getBrowserQueryClient } from "@/components/query-provider"
import { NavigationProgress } from "@/components/navigation-progress"
import { parseAdminArchiveOptions } from "@/features/writing/utils/admin-archive-options"

async function loadAdminPage<T>(queryKey: QueryKey, queryFn: () => Promise<T>) {
  const client = getBrowserQueryClient()
  // Verify initial access before requesting private page data. APIs also enforce author access.
  const session = await client.ensureQueryData({
    queryKey: adminKeys.session,
    queryFn: adminApi.session,
  })
  if (session.author) await client.prefetchQuery({ queryKey, queryFn })
  return null
}

function AdminRoot() {
  return (
    <>
      <NavigationProgress initialSpinner={false} />
      <Outlet />
    </>
  )
}

function AdminInitialLoading() {
  return <AdminLoading />
}
function ProtectedAdmin() {
  const location = useLocation()
  const previousPath = useRef(location.pathname)
  const client = useQueryClient()
  const session = useQuery({
    queryKey: adminKeys.session,
    queryFn: adminApi.session,
    staleTime: 0,
    refetchOnMount: "always",
  })
  useEffect(() => {
    const expire = () => {
      client.removeQueries({ queryKey: adminKeys.all })
      client.getMutationCache().clear()
      window.location.replace("/admin/login")
    }
    window.addEventListener("admin-session-expired", expire)
    const stop = client.getQueryCache().subscribe((event) => {
      if (
        event.type === "updated" &&
        event.query.state.error instanceof HTTPError &&
        [401, 403].includes(event.query.state.error.response.status)
      ) {
        client.removeQueries({ queryKey: adminKeys.all })
        client.getMutationCache().clear()
        window.location.replace("/admin/login")
      }
    })
    return () => {
      stop()
      window.removeEventListener("admin-session-expired", expire)
    }
  }, [client])
  useEffect(() => {
    if (previousPath.current !== location.pathname) {
      previousPath.current = location.pathname
      void client.invalidateQueries({ queryKey: adminKeys.session })
    }
  }, [location.pathname, client])
  useEffect(() => {
    if (session.data && !session.data.author) {
      client.removeQueries({
        predicate: (query) => query.queryKey[0] === "admin" && query.queryKey[1] !== "session",
      })
      client.getMutationCache().clear()
    }
  }, [session.data, client])
  if (session.isPending) return <AdminLoading />
  if (session.isError) return <AdminError retry={() => void session.refetch()} />
  if (!session.data.author) return <Navigate to="/admin/login" replace />
  return (
    <AdminSessionContext value={session.data}>
      <Outlet />
    </AdminSessionContext>
  )
}
function AdminRouteError() {
  return <AdminError retry={() => window.location.reload()} />
}
export const router = createBrowserRouter([
  {
    Component: AdminRoot,
    HydrateFallback: AdminInitialLoading,
    ErrorBoundary: AdminRouteError,
    children: [
      { path: "/admin/login", ErrorBoundary: AdminRouteError, lazy: () => import("./login") },
      {
        path: "/admin",
        Component: ProtectedAdmin,
        ErrorBoundary: AdminRouteError,
        children: [
          {
            index: true,
            loader: () => loadAdminPage(adminKeys.overview, adminApi.overview),
            lazy: () => import("./overview"),
          },
          {
            path: "posts",
            loader: ({ request }) => {
              const options = parseAdminArchiveOptions(new URL(request.url).searchParams)
              return loadAdminPage(adminKeys.archive(options), () =>
                adminApi.archive(options, request.signal)
              )
            },
            lazy: () => import("./posts"),
          },
          { path: "new", lazy: () => import("./new") },
          {
            path: "edit/:id",
            loader: ({ params }) =>
              loadAdminPage(adminKeys.post(params.id ?? ""), () => adminApi.post(params.id ?? "")),
            lazy: () => import("./edit"),
          },
        ],
      },
      { path: "*", element: <p>Page not found.</p> },
    ],
  },
])
