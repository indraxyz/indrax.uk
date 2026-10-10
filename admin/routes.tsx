import { createBrowserRouter, Outlet } from "react-router"
import type { QueryKey } from "@tanstack/react-query"
import { adminApi, adminKeys } from "@/features/writing/api/client"
import { AdminLoading, AdminError } from "@/admin/components/feedback/request-state"
import { ProtectedAdmin } from "@/admin/layouts/protected-admin"
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
            loader: () => loadAdminPage(adminKeys.overview, adminApi.overview),
            lazy: () => import("./routes/dashboard/overview"),
          },
          {
            path: "posts",
            loader: ({ request }) => {
              const options = parseAdminArchiveOptions(new URL(request.url).searchParams)
              return loadAdminPage(adminKeys.archive(options), () =>
                adminApi.archive(options, request.signal)
              )
            },
            lazy: () => import("./routes/posts/list"),
          },
          { path: "new", lazy: () => import("./routes/posts/new") },
          {
            path: "edit/:id",
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
