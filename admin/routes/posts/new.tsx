import { AdminShell } from "@/admin/components/layout/admin-shell"
import { PostForm } from "@/features/writing/components/admin/post-form"
import { useAdminSession } from "@/admin/auth/session"
export function Component() {
  const session = useAdminSession()
  return (
    <PostForm post={null} coverUploadsConfigured={session.coverUploadsConfigured}>
      {({ form, saveButton }) => (
        <AdminShell
          title="New post"
          backLink={{ href: "/admin/posts", label: "Posts" }}
          actions={saveButton}
        >
          {form}
        </AdminShell>
      )}
    </PostForm>
  )
}
