import { ExternalLink, Plus } from "lucide-react"
import Link from "next/link"
import { redirect } from "next/navigation"

import { controlClassNames } from "@/components/ui/variants"
import { AdminShell } from "@/features/blog/components/admin/admin-shell"
import { PostRow } from "@/features/blog/components/admin/post-row"
import { listAllPosts } from "@/features/blog/data/admin-queries"
import { BLOG_CONFIG } from "@/features/blog/config"
import { getAuthor } from "@/lib/auth-guard"
import { cn } from "@/lib/utils"

export default async function AdminPostsPage() {
  if (!(await getAuthor())) redirect("/admin/login")

  const posts = await listAllPosts()

  return (
    <AdminShell
      title="Posts"
      activePage="posts"
      pageNavigation={
        <nav aria-label="Posts page" className="flex justify-end">
          <Link
            href={BLOG_CONFIG.basePath}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Blogs <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </nav>
      }
      actions={
        <Link href="/admin/new" className={cn(controlClassNames, "px-3 py-2")}>
          <Plus className="h-3.5 w-3.5" aria-hidden />
          New post
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
