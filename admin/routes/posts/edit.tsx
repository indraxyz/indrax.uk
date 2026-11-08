import { useParams } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { HTTPError } from "ky"
import { adminApi, adminKeys } from "@/features/writing/api/client"
import { AdminShell } from "@/admin/components/layout/admin-shell"
import { PostForm } from "@/features/writing/components/admin/post-form"
import { PostActions } from "@/features/writing/components/admin/post-actions"
import { useAdminSession } from "@/admin/auth/session"
import { AdminLoading, AdminError } from "@/admin/components/feedback/request-state"
export function Component() {
  const { id = "" } = useParams()
  const session = useAdminSession()
  const query = useQuery({ queryKey: adminKeys.post(id), queryFn: () => adminApi.post(id) })
  if (query.isPending) return <AdminLoading />
  if (!query.data && query.error instanceof HTTPError && query.error.response.status === 404)
    return (
      <AdminShell title="Not found">
        <p>This post does not exist.</p>
      </AdminShell>
    )
  if (!query.data) return <AdminError retry={() => void query.refetch()} />
  return (
    <PostForm key={id} post={query.data} coverUploadsConfigured={session.coverUploadsConfigured}>
      {({
        form,
        saveButton,
        onDeleted,
        hasUnsavedChanges,
        isSaving,
        onRefresh,
        onActionsBusyChange,
      }) => (
        <AdminShell
          title="Edit post"
          backLink={{ href: "/admin/posts", label: "Posts" }}
          actions={
            <PostActions
              post={query.data}
              onDeleted={onDeleted}
              hasUnsavedChanges={hasUnsavedChanges}
              saving={isSaving}
              onRefresh={onRefresh}
              onBusyChange={onActionsBusyChange}
            >
              {saveButton}
            </PostActions>
          }
        >
          {query.isError && (
            <p role="alert" className="mb-4 text-sm text-destructive">
              The saved post could not be rechecked. Your editor changes are still here. Use Refresh
              post to try again.
            </p>
          )}
          {form}
        </AdminShell>
      )}
    </PostForm>
  )
}
