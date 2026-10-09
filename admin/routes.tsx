import { useEffect, useRef } from "react"
import { createBrowserRouter, Navigate, Outlet, useLocation } from "react-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { HTTPError } from "ky"
import { adminApi, adminKeys } from "@/features/writing/api/client"
import { AdminSessionContext, AdminLoading, AdminError } from "./shared"
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
  { path: "/admin/login", ErrorBoundary: AdminRouteError, lazy: () => import("./login") },
  {
    path: "/admin",
    Component: ProtectedAdmin,
    ErrorBoundary: AdminRouteError,
    children: [
      { index: true, lazy: () => import("./overview") },
      { path: "posts", lazy: () => import("./posts") },
      { path: "new", lazy: () => import("./new") },
      { path: "edit/:id", lazy: () => import("./edit") },
    ],
  },
  { path: "*", element: <p>Page not found.</p> },
])
