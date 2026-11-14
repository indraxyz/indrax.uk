import { useEffect } from "react"
import { useLocation } from "react-router"
import { getAdminPreferences } from "@/admin/state/admin-preferences"
import { resetAdminNavigation } from "@/admin/state/admin-navigation"
import { createBrowserRouter, Outlet, redirect } from "react-router"
import type { QueryKey } from "@tanstack/react-query"
import { adminApi, adminKeys } from "@/features/writing/api/client"
import { adminSessionOptions } from "@/features/writing/api/session-query"
import { AdminLoading, AdminError } from "@/admin/components/feedback/request-state"
import { ProtectedAdmin } from "@/admin/layouts/protected-admin"
import { getBrowserQueryClient } from "@/components/query-provider"
import { NavigationProgress } from "@/components/navigation-progress"

async function loadAdminPage<T>(queryKey?: QueryKey, queryFn?: () => Promise<T>) {
  const client = getBrowserQueryClient()
  // Verify initial access before requesting private page data. APIs also enforce author access.
  const session = await client.fetchQuery(adminSessionOptions)
  if (session.author && queryKey && queryFn) await client.prefetchQuery({ queryKey, queryFn })
  return null
}

function AdminRoot() {
  const location = useLocation()
  useEffect(() => getAdminPreferences().subscribe(() => {}), [])
  useEffect(() => {
    resetAdminNavigation()
  }, [location.key])
  return (
    <>
      <NavigationProgress />
      <Outlet />
    </>
  )
}

function AdminInitialLoading() {
  return <AdminLoading />
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
      {
        path: "/admin/login",
        ErrorBoundary: AdminRouteError,
        lazy: () => import("./routes/auth/login"),
      },
      {
        path: "/admin",
        Component: ProtectedAdmin,
        ErrorBoundary: AdminRouteError,
        children: [
          {
            index: true,
            loader: () => loadAdminPage(),
            lazy: () => import("./routes/dashboard/overview"),
          },
          {
            path: "posts",
            // Verify access first, then let the mounted Query consumer show its skeleton.
            loader: () => loadAdminPage(),
            lazy: () => import("./routes/posts/list"),
          },
          { path: "new", loader: () => redirect("/admin/posts/new") },
          {
            path: "edit/:id",
            loader: ({ params }) =>
              redirect(`/admin/posts/edit/${encodeURIComponent(params.id ?? "")}`),
          },
          {
            path: "posts/new",
            loader: () => loadAdminPage(),
            lazy: () => import("./routes/posts/new"),
          },
          {
            path: "posts/edit/:id",
            loader: ({ params }) =>
              loadAdminPage(adminKeys.post(params.id ?? ""), () => adminApi.post(params.id ?? "")),
            lazy: () => import("./routes/posts/edit"),
          },
        ],
      },
      { path: "*", element: <p>Page not found.</p> },
    ],
  },
])
