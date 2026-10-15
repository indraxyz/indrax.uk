import { PostActions } from "@/features/writing/components/admin/post-actions"
import { AdminShell } from "@/admin/components/layout/admin-shell"
import { PostForm } from "@/features/writing/components/admin/post-form"
import { useAdminSession } from "@/admin/auth/session"
export function Component() {
  const session = useAdminSession()
  return (
    <PostForm post={null} coverUploadsConfigured={session.coverUploadsConfigured}>
      {({ form, saveButton, isSaving }) => (
        <AdminShell
          title="New post"
          backLink={{ href: "/admin/posts", label: "Posts" }}
          actions={
            <PostActions post={null} saving={isSaving}>
              {saveButton}
            </PostActions>
          }
        >
          {form}
        </AdminShell>
      )}
    </PostForm>
  )
}
