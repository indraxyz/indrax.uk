import { createContext, useContext } from "react"
import { AdminShell } from "@/admin/components/admin-shell"
import type { AdminSession } from "@/features/writing/api/client"
import { PageLoading } from "@/components/page-loading"
export const AdminSessionContext = createContext<AdminSession | null>(null)
export function useAdminSession() {
  const value = useContext(AdminSessionContext)
  if (!value) throw new Error("Admin session provider is missing")
  return value
}
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
