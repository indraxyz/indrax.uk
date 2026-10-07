import { redirect } from "next/navigation"

import { AdminShell } from "@/features/writing/components/admin/admin-shell"
import { PostForm } from "@/features/writing/components/admin/post-form"
import { getAuthor } from "@/lib/auth-guard"
import { getCoverStorageConfig } from "@/lib/cover-storage"

export default async function NewPostPage() {
  if (!(await getAuthor())) redirect("/admin/login")

  return (
    <AdminShell title="New post" backLink={{ href: "/admin/posts", label: "Posts" }}>
      <PostForm post={null} coverUploadsConfigured={Boolean(getCoverStorageConfig())} />
    </AdminShell>
  )
}
