import { AdminShell } from "@/admin/components/layout/admin-shell"
import { PageLoading } from "@/components/page-loading"
export function AdminLoading() {
  return <PageLoading />
}
export function AdminError({ retry }: { retry: () => void }) {
  return (
    <AdminShell title="Workspace unavailable">
      <p role="alert">The request could not be completed.</p>
      <button type="button" onClick={retry}>
        Try again
      </button>
    </AdminShell>
  )
}
