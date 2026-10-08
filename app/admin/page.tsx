import { ArrowRight, FilePenLine, Plus } from "lucide-react"
import Link from "next/link"
import { redirect } from "next/navigation"

import { controlClassNames } from "@/components/ui/variants"
import { AdminShell } from "@/features/writing/components/admin/admin-shell"
import { listAllPosts } from "@/features/writing/data/admin-queries"
import { getAuthor } from "@/lib/auth-guard"
import { getCoverStorageConfig } from "@/lib/cover-storage"
import { cn } from "@/lib/utils"

export default async function AdminPage() {
  if (!(await getAuthor())) redirect("/admin/login")

  const posts = await listAllPosts()
  const published = posts.filter((post) => post.status === "published").length
  const drafts = posts.filter((post) => post.status === "draft").length
  const archived = posts.filter((post) => post.status === "archived").length
  const latestDraft = posts.find((post) => post.status === "draft")
  const coverUploadsConfigured = Boolean(getCoverStorageConfig())
  const analyticsConfigured = Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY)

  const services = [
    {
      name: "GitHub sign-in",
      state: "Active",
      description: "Your author session is verified for this workspace.",
    },
    {
      name: "Postgres",
      state: "Connected",
      description: "The post counts above were read from the writing database.",
    },
    {
      name: "Cover uploads",
      state: coverUploadsConfigured ? "Configured" : "Not configured",
      description: coverUploadsConfigured
        ? "Upload cover images while editing a post."
        : "Add R2 storage and a media origin to upload cover images.",
    },
    {
      name: "Analytics",
      state: analyticsConfigured ? "Configured" : "Off",
      description: analyticsConfigured
        ? "Visitor measurements start only after consent."
        : "Add a PostHog project key to enable consent-based measurements.",
    },
  ]

  return (
    <AdminShell
      title="Overview"
      activePage="home"
      actions={
        <Link prefetch={false} href="/admin/new" className={cn(controlClassNames, "px-3 py-2")}>
          <Plus className="h-3.5 w-3.5" aria-hidden />
          New post
        </Link>
      }
    >
      <p className="text-sm font-semibold text-muted-foreground">Welcome back, Indra.</p>

      <section aria-labelledby="posts-heading" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="posts-heading" className="text-lg font-black uppercase tracking-tight">
              Posts
            </h2>
            <p className="text-sm font-semibold text-muted-foreground">
              A live summary of your articles.
            </p>
          </div>
          <Link
            prefetch={false}
            href="/admin/posts"
            className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Manage posts <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "All posts", value: posts.length },
            { label: "Published", value: published },
            { label: "Drafts", value: drafts },
            { label: "Archived", value: archived },
          ].map(({ label, value }) => (
            <div key={label} className="border-2 border-border bg-card px-5 py-4 shadow-soft">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
                {label}
              </p>
              <p className="mt-2 text-3xl font-black tabular-nums">{value}</p>
            </div>
          ))}
        </div>
      </section>

      <section
        aria-labelledby="next-heading"
        className="flex flex-wrap items-start justify-between gap-4 border-2 border-border bg-card p-6 shadow-soft"
      >
        <div className="space-y-2">
          <h2 id="next-heading" className="text-lg font-black uppercase tracking-tight">
            Continue writing
          </h2>
          <p className="text-sm font-semibold text-muted-foreground">
            {latestDraft
              ? "Your most recently edited draft is “" + latestDraft.title + "”."
              : "Start a draft to prepare your next article."}
          </p>
        </div>
        <Link
          prefetch={false}
          href={latestDraft ? "/admin/edit/" + latestDraft.id : "/admin/new"}
          className={cn(controlClassNames, "px-3 py-2")}
        >
          <FilePenLine className="h-3.5 w-3.5" aria-hidden />
          {latestDraft ? "Edit draft" : "New post"}
        </Link>
      </section>

      <section aria-labelledby="services-heading" className="space-y-4">
        <div>
          <h2 id="services-heading" className="text-lg font-black uppercase tracking-tight">
            Workspace services
          </h2>
          <p className="text-sm font-semibold text-muted-foreground">
            What is available while you write and publish.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {services.map(({ name, state, description }) => (
            <div key={name} className="border-2 border-border bg-card px-5 py-4 shadow-soft">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-black uppercase tracking-tight">{name}</h3>
                <span className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
                  {state}
                </span>
              </div>
              <p className="mt-2 text-sm font-semibold text-muted-foreground">{description}</p>
            </div>
          ))}
        </div>
      </section>
    </AdminShell>
  )
}
