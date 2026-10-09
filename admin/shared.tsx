import { createContext, useContext } from "react"
import { AdminShell } from "@/features/writing/components/admin/admin-shell"
import type { AdminSession } from "@/features/writing/api/client"
export const AdminSessionContext = createContext<AdminSession | null>(null)
export function useAdminSession() {
  const value = useContext(AdminSessionContext)
  if (!value) throw new Error("Admin session provider is missing")
  return value
}
export function AdminLoading() {
  return (
    <main aria-busy className="mx-auto min-h-screen max-w-5xl space-y-4 px-6 py-12">
      <h1 className="text-2xl font-black uppercase tracking-tight">Loading</h1>
      <p role="status">Loading your workspace…</p>
    </main>
  )
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
