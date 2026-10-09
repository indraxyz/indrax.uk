import { AdminShell } from "@/features/writing/components/admin/admin-shell"
import { PostForm } from "@/features/writing/components/admin/post-form"
import { useAdminSession } from "./shared"
export function Component() {
  const session = useAdminSession()
  return (
    <AdminShell title="New post" backLink={{ href: "/admin/posts", label: "Posts" }}>
      <PostForm post={null} coverUploadsConfigured={session.coverUploadsConfigured} />
    </AdminShell>
  )
}
