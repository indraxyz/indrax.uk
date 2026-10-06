import { notFound, redirect } from "next/navigation"

import { AdminShell } from "@/features/writing/components/admin/admin-shell"
import { PostActions } from "@/features/writing/components/admin/post-actions"
import { PostForm } from "@/features/writing/components/admin/post-form"
import { getPostForEdit } from "@/features/writing/data/admin-queries"
import { getAuthor } from "@/lib/auth-guard"

interface EditPostPageProps {
  params: Promise<{ id: string }>
}

export default async function EditPostPage({ params }: EditPostPageProps) {
  if (!(await getAuthor())) redirect("/admin/login")

  const { id } = await params
  const post = await getPostForEdit(id)

  if (!post) notFound()

  return (
    <AdminShell
      title="Edit post"
      backLink={{ href: "/admin/posts", label: "Posts" }}
      actions={<PostActions post={post} />}
    >
      <PostForm post={post} />
    </AdminShell>
  )
}
