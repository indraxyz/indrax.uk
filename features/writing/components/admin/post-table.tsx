import { ArrowDown, ArrowUp, ArrowUpDown, PencilLine } from "lucide-react"
import { memo, useId, useMemo } from "react"
import { Link, useSearchParams } from "react-router"
import {
  createColumnHelper,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type Header,
  type SortingState,
} from "@tanstack/react-table"

import { Badge } from "@/components/ui/badge"
import { PostActions } from "./post-actions"
import { ADMIN_DATE_FORMAT, EDIT_ICON_LINK_CLASS, STATUS_TONE } from "./post-display"
import type { AdminPostSummary } from "@/features/writing/types"
import {
  adminArchiveSearchParams,
  type AdminArchiveOptions,
} from "@/features/writing/utils/admin-archive-options"
import {
  archiveSortForTableSorting,
  tableSortingForArchiveSort,
} from "@/features/writing/utils/admin-post-sorting"
import { ARCHIVE_SORT_LABELS } from "@/features/writing/utils/archive-options"
import { cn, formatDate } from "@/lib/utils"

interface PostColumnMeta {
  className?: string
  // The title names each row for assistive technology, so it is a row header.
  rowHeader?: boolean
  // Pinned to the start while the rest scrolls, so a narrow screen keeps each
  // row's post in view. Header and body cells need their own opaque background.
  sticky?: boolean
  srOnlyHeader?: boolean
}

const features = tableFeatures({ rowSortingFeature, columnMeta: {} as PostColumnMeta })
const column = createColumnHelper<typeof features, AdminPostSummary>()

// What activating a header does next, read after the column name.
const SORT_HINTS: Partial<Record<AdminArchiveOptions["sort"], string>> = {
  "title-asc": "sort A to Z",
  "title-desc": "sort Z to A",
  newest: "sort newest first",
  oldest: "sort oldest first",
  updated: "sort most recently updated first",
}

function DateCell({ value, empty }: { value: string | null; empty: string }) {
  return value ? (
    <time dateTime={value}>{formatDate(value, ADMIN_DATE_FORMAT)}</time>
  ) : (
    <span className="text-muted-foreground">{empty}</span>
  )
}

const columns = column.columns([
  column.accessor("title", {
    header: "Title",
    meta: {
      rowHeader: true,
      sticky: true,
      className: "min-w-[10rem] max-w-[14rem] sm:min-w-[16rem] sm:max-w-md",
    },
    cell: ({ row }) => (
      <Link
        to={`/admin/posts/edit/${row.original.id}`}
        className="break-words font-black uppercase tracking-tight hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {row.original.title}
      </Link>
    ),
  }),
  column.accessor("status", {
    header: "Status",
    enableSorting: false,
    cell: ({ getValue }) => <Badge variant={STATUS_TONE[getValue()]}>{getValue()}</Badge>,
  }),
  column.accessor((post) => post.tags.map((tag) => tag.name).join(", "), {
    id: "tags",
    header: "Tags",
    enableSorting: false,
    meta: { className: "min-w-[10rem]" },
    cell: ({ getValue }) =>
      getValue() || (
        <>
          <span aria-hidden="true" className="text-muted-foreground">
            —
          </span>
          <span className="sr-only">No tags</span>
        </>
      ),
  }),
  column.accessor("publishedAt", {
    header: "Published",
    sortDescFirst: true,
    meta: { className: "whitespace-nowrap" },
    cell: ({ getValue }) => <DateCell value={getValue()} empty="Not published" />,
  }),
  column.accessor("updatedAt", {
    header: "Updated",
    sortDescFirst: true,
    meta: { className: "whitespace-nowrap" },
    cell: ({ getValue }) => <DateCell value={getValue()} empty="—" />,
  }),
  column.display({
    id: "actions",
    header: "Actions",
    meta: { srOnlyHeader: true, className: "w-0" },
    cell: ({ row }) => (
      <div className="flex items-center justify-end gap-2">
        <Link
          to={`/admin/posts/edit/${row.original.id}`}
          className={EDIT_ICON_LINK_CLASS}
          aria-label={`Edit ${row.original.title}`}
        >
          <PencilLine className="h-4 w-4" aria-hidden />
        </Link>
        <PostActions post={row.original} context="list" />
      </div>
    ),
  }),
])

type PostHeader = Header<typeof features, AdminPostSummary, unknown>

function ColumnHeader({ header, sort }: { header: PostHeader; sort: AdminPostsSort }) {
  const { column } = header
  const label = String(column.columnDef.header)
  const meta = column.columnDef.meta
  const sorted = column.getIsSorted()
  const nextOrder = column.getCanSort() ? column.getNextSortingOrder() : false
  const nextSort = nextOrder
    ? archiveSortForTableSorting([{ id: column.id, desc: nextOrder === "desc" }])
    : null
  // Only offer a button when activating it changes the order; "Updated" has a
  // single direction, so once selected it is a plain, still-announced header.
  const actionable = nextSort !== null && nextSort !== sort
  const SortIcon = sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ArrowUpDown

  return (
    <th
      scope="col"
      aria-sort={sorted ? (sorted === "asc" ? "ascending" : "descending") : undefined}
      className={cn(
        "whitespace-nowrap px-3 py-2 text-left text-xs font-black uppercase tracking-[0.14em] text-muted-foreground",
        meta?.className,
        meta?.sticky && cn(STICKY_CELL, "bg-[var(--color-muted)]")
      )}
    >
      {meta?.srOnlyHeader ? (
        <span className="sr-only">{label}</span>
      ) : actionable ? (
        <button
          type="button"
          // Starts with the visible label, then says what activating it does next.
          aria-label={`${label}: ${SORT_HINTS[nextSort]}`}
          onClick={column.getToggleSortingHandler()}
          className="-mx-2 inline-flex min-h-11 items-center gap-1.5 px-2 uppercase tracking-[0.14em] transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {label}
          <SortIcon className={cn("h-3.5 w-3.5", !sorted && "opacity-50")} aria-hidden />
        </button>
      ) : (
        <span className="inline-flex min-h-11 items-center gap-1.5">
          {label}
          {sorted && <SortIcon className="h-3.5 w-3.5" aria-hidden />}
        </span>
      )}
    </th>
  )
}

type AdminPostsSort = AdminArchiveOptions["sort"]

// `z-[1]` keeps the pinned column above cells scrolling beneath it. The end edge
// is an inset shadow because collapsed table borders do not travel with a sticky
// cell. Card surfaces are translucent, so the body cell stacks the card tint on
// the opaque page colour: it matches the region behind it and hides what scrolls
// underneath.
const STICKY_CELL = "sticky left-0 z-[1] shadow-[inset_-2px_0_0_var(--color-border)]"
const STICKY_BODY_CELL =
  "bg-[var(--color-background)] bg-[image:linear-gradient(var(--color-card),var(--color-card))] transition-colors group-hover:bg-[var(--color-muted)] group-hover:bg-none"

/**
 * A dense, sortable alternative to the post cards.
 *
 * Rows arrive one server page at a time, so sorting is manual: a header writes the
 * matching archive ordering to the URL, and the backend sorts the full set.
 */
export const PostTable = memo(function PostTable({
  posts,
  options,
}: {
  posts: AdminPostSummary[]
  options: AdminArchiveOptions
}) {
  const [, setParams] = useSearchParams()
  const captionId = useId()
  // Stable table state between renders, so the table does not treat each render
  // as a sorting change and rebuild its row model.
  const sorting = useMemo(() => tableSortingForArchiveSort(options.sort), [options.sort])
  const table = useTable({
    features,
    columns,
    data: posts,
    getRowId: (post) => post.id,
    state: { sorting },
    manualSorting: true,
    enableMultiSort: false,
    enableSortingRemoval: false,
    onSortingChange: (updater) => {
      const next: SortingState = typeof updater === "function" ? updater(sorting) : updater
      const sort = archiveSortForTableSorting(next)
      if (sort && sort !== options.sort)
        setParams(adminArchiveSearchParams({ ...options, sort, page: 1 }))
    },
  })

  return (
    // A wide table scrolls inside its own named, keyboard-reachable region rather
    // than widening the page. `relative` makes the region the containing block for
    // the cells' visually hidden text, which would otherwise escape the clipping.
    <div
      role="region"
      aria-labelledby={captionId}
      tabIndex={0}
      className="relative overflow-x-auto border-2 border-border bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <table className="w-full border-collapse text-sm">
        <caption id={captionId} className="sr-only">
          Posts, ordered by {ARCHIVE_SORT_LABELS[options.sort].toLowerCase()}
        </caption>
        <thead className="border-b-2 border-border bg-[var(--color-muted)]">
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((header) => (
                <ColumnHeader key={header.id} header={header} sort={options.sort} />
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              className="group border-t-2 border-border align-middle transition-colors first:border-t-0 hover:bg-[var(--color-muted)]"
            >
              {row.getAllCells().map((cell) => {
                const meta = cell.column.columnDef.meta
                const Cell = meta?.rowHeader ? "th" : "td"
                return (
                  <Cell
                    key={cell.id}
                    scope={meta?.rowHeader ? "row" : undefined}
                    className={cn(
                      "px-3 py-3 text-left font-medium",
                      meta?.className,
                      meta?.sticky && cn(STICKY_CELL, STICKY_BODY_CELL)
                    )}
                  >
                    <table.FlexRender cell={cell} />
                  </Cell>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
})
