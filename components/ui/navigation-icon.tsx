import { BookOpenText, FileUser, Files, House, Layers, LayoutDashboard } from "lucide-react"

const outlines = {
  home: House,
  resume: FileUser,
  writing: BookOpenText,
  "tech-stack": Layers,
  dashboard: LayoutDashboard,
  posts: Files,
}

// Dedicated solid silhouettes keep details as cutouts; filling an outline icon
// directly would obscure its interior strokes. Both states inherit the theme ink.
const solids: Record<keyof typeof outlines, string> = {
  home: "M12 2 1 11h3v10h6v-7h4v7h6V11h3L12 2Z",
  resume:
    "M5 1h10l5 5v17H5V1Zm10 2v5h4l-4-5ZM12 10a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Zm-5 10h10v-1c0-2-2-3-5-3s-5 1-5 3v1Z",
  writing:
    "M2 3c4-1 7 0 10 2 3-2 6-3 10-2v17c-4-1-7 0-10 2-3-2-6-3-10-2V3Zm9 4v12h2V7h-2ZM4 7v2h5V7H4Zm11 0v2h5V7h-5ZM4 11v2h5v-2H4Zm11 0v2h5v-2h-5Z",
  "tech-stack":
    "M12 1 23 7 12 13 1 7 12 1ZM2 10l10 6 10-6 1 2-11 7-11-7 1-2Zm0 5 10 6 10-6 1 2-11 7-11-7 1-2Z",
  dashboard: "M2 2h9v9H2V2Zm12 0h8v5h-8V2Zm0 8h8v12h-8V10ZM2 14h9v8H2v-8Z",
  posts: "M6 1h10l5 5v14H6V1Zm10 2v5h4l-4-5ZM9 11v2h9v-2H9Zm0 4v2h9v-2H9ZM2 5h2v17h13v2H2V5Z",
}

export function NavigationIcon({
  name,
  active = false,
  className,
}: {
  name: keyof typeof outlines
  active?: boolean
  className?: string
}) {
  if (!active) {
    const Icon = outlines[name]
    return <Icon className={className} aria-hidden data-variant="outline" />
  }
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
      focusable="false"
      data-variant="filled"
    >
      <path d={solids[name]} fillRule="evenodd" clipRule="evenodd" />
    </svg>
  )
}
