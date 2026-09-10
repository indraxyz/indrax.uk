import { Plus } from "lucide-react"
import Link from "next/link"
import { redirect } from "next/navigation"

import { controlClassNames } from "@/components/ui/variants"
import { AdminShell } from "@/features/blog/components/admin/admin-shell"
import { PostRow } from "@/features/blog/components/admin/post-row"
import { listAllPosts } from "@/features/blog/data/admin-queries"
import { getAuthor } from "@/lib/auth-guard"
import { cn } from "@/lib/utils"

export default async function AdminPage() {
  // `proxy.ts` only checks that a cookie is present. This is the check that
  // decides, and it runs whether or not the request went through routing.
  if (!(await getAuthor())) redirect("/admin/login")

  const posts = await listAllPosts()

  return (
    <AdminShell
      title="Posts"
      actions={
        <Link href="/admin/new" className={cn(controlClassNames, "px-3 py-2")}>
          <Plus className="h-3.5 w-3.5" aria-hidden />
          New
        </Link>
      }
    >
      {posts.length === 0 ? (
        <div className="border-2 border-dashed border-border px-6 py-16 text-center">
          <p className="text-sm font-semibold text-muted-foreground">
            Nothing written yet. Start with{" "}
            <Link href="/admin/new" className="underline">
              a new post
            </Link>
            .
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {posts.map((post) => (
            <PostRow key={post.id} post={post} />
          ))}
        </ul>
      )}
    </AdminShell>
  )
}
