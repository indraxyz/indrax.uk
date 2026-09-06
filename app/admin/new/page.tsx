import { redirect } from "next/navigation"

import { AdminShell } from "@/features/blog/components/admin/admin-shell"
import { PostForm } from "@/features/blog/components/admin/post-form"
import { getAuthor } from "@/lib/auth-guard"

export default async function NewPostPage() {
  if (!(await getAuthor())) redirect("/admin/login")

  return (
    <AdminShell title="New post">
      <PostForm post={null} />
    </AdminShell>
  )
}
