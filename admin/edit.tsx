import { useParams } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { HTTPError } from "ky"
import { adminApi, adminKeys } from "@/features/writing/api/client"
import { AdminShell } from "@/features/writing/components/admin/admin-shell"
import { PostForm } from "@/features/writing/components/admin/post-form"
import { PostActions } from "@/features/writing/components/admin/post-actions"
import { useAdminSession, AdminLoading, AdminError } from "./shared"
export function Component() {
  const { id = "" } = useParams()
  const session = useAdminSession()
  const query = useQuery({ queryKey: adminKeys.post(id), queryFn: () => adminApi.post(id) })
  if (query.isPending) return <AdminLoading />
  if (query.error instanceof HTTPError && query.error.response.status === 404)
    return (
      <AdminShell title="Not found">
        <p>This post does not exist.</p>
      </AdminShell>
    )
  if (query.isError) return <AdminError retry={() => void query.refetch()} />
  return (
    <AdminShell
      title="Edit post"
      backLink={{ href: "/admin/posts", label: "Posts" }}
      actions={<PostActions post={query.data} />}
    >
      <PostForm
        key={id}
        post={query.data}
        coverUploadsConfigured={session.coverUploadsConfigured}
      />
    </AdminShell>
  )
}
