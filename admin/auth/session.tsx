import { createContext, useContext } from "react"
import type { AuthorSession } from "@/features/writing/api/client"
export const AdminSessionContext = createContext<AuthorSession | null>(null)
export function useAdminSession() {
  const value = useContext(AdminSessionContext)
  if (!value) throw new Error("Admin session provider is missing")
  return value
}
