import { Plus } from "lucide-react"
import { Link } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { adminApi, adminKeys } from "@/features/writing/api/client"
import { AdminShell } from "@/features/writing/components/admin/admin-shell"
import { PostRow } from "@/features/writing/components/admin/post-row"
import { controlClassNames } from "@/components/ui/variants"
import { AdminLoading, AdminError } from "./shared"
export function Component() {
  const query = useQuery({ queryKey: adminKeys.posts, queryFn: adminApi.posts })
  if (query.isPending) return <AdminLoading />
  if (query.isError) return <AdminError retry={() => void query.refetch()} />
  return (
    <AdminShell
      title="Posts"
      activePage="posts"
      actions={
        <Link to="/admin/new" className={`${controlClassNames} px-3 py-2`}>
          <Plus className="h-3.5 w-3.5" aria-hidden />
          New post
        </Link>
      }
    >
      {query.data.length ? (
        <ul className="space-y-3">
          {query.data.map((post) => (
            <PostRow key={post.id} post={post} />
          ))}
        </ul>
      ) : (
        <div className="border-2 border-dashed border-border px-6 py-16 text-center">
          <p>
            Nothing written yet. Start with{" "}
            <Link to="/admin/new" className="underline">
              a new post
            </Link>
            .
          </p>
        </div>
      )}
    </AdminShell>
  )
}
