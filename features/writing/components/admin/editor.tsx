import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react"
import {
  BetweenHorizontalEnd,
  BetweenHorizontalStart,
  BetweenVerticalEnd,
  BetweenVerticalStart,
  Bold,
  Braces,
  Code2,
  Columns2,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  ListTodo,
  Minus,
  PanelLeft,
  PanelTop,
  Quote,
  Redo2,
  Rows2,
  Square,
  Strikethrough,
  TableCellsMerge,
  TableCellsSplit,
  Table as TableIcon,
  Undo2,
  X,
} from "lucide-react"
import { useEffect, useRef, type ReactNode } from "react"

import { controlClassNames } from "@/components/ui/variants"
import { WRITING_EXTENSIONS } from "@/features/writing/editor/extensions"
import type { PostDocument } from "@/features/writing/types"
import { cn } from "@/lib/utils"

const EMPTY_DOCUMENT: PostDocument = { type: "doc", content: [{ type: "paragraph" }] }

interface EditorProps {
  value: PostDocument | null
  onChange: (document: PostDocument) => void
}

interface ToolProps {
  label: string
  icon: ReactNode
  active?: boolean
  disabled?: boolean
  onClick: () => void
}

function Tool({ label, icon, active, disabled, onClick }: ToolProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        controlClassNames,
        "shrink-0 px-2.5 py-2 disabled:opacity-40",
        active && "bg-[var(--color-accent)] text-[var(--color-accent-foreground)]"
      )}
    >
      {icon}
    </button>
  )
}

const TABLE_ACTIONS = [
  ["addRowBefore", "Add row above", BetweenHorizontalStart, null],
  ["addRowAfter", "Add row below", BetweenHorizontalEnd, null],
  ["deleteRow", "Delete row", Rows2, Minus],
  ["addColumnBefore", "Add column before", BetweenVerticalStart, null],
  ["addColumnAfter", "Add column after", BetweenVerticalEnd, null],
  ["deleteColumn", "Delete column", Columns2, Minus],
  ["mergeCells", "Merge cells", TableCellsMerge, null],
  ["splitCell", "Split cell", TableCellsSplit, null],
  ["toggleHeaderRow", "Toggle header row", PanelTop, null],
  ["toggleHeaderColumn", "Toggle header column", PanelLeft, null],
  ["toggleHeaderCell", "Toggle header cell", Square, null],
  ["deleteTable", "Delete table", TableIcon, X],
] as const

function Toolbar({ editor }: { editor: Editor }) {
  // Tiptap v3 does not rerender useEditor consumers on transactions by default.
  // Subscribe the controls so selection changes update active/available actions.
  useEditorState({ editor, selector: ({ transactionNumber }) => transactionNumber })
  const icon = "h-3.5 w-3.5"

  return (
    <div className="sticky top-[var(--admin-header-height,0px)] z-40 border-b-2 border-border bg-[var(--color-muted)]">
      <div role="toolbar" aria-label="Formatting" className="flex flex-wrap gap-1 p-2">
        <Tool
          label="Bold"
          icon={<Bold className={icon} />}
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        />
        <Tool
          label="Italic"
          icon={<Italic className={icon} />}
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />
        <Tool
          label="Strikethrough"
          icon={<Strikethrough className={icon} />}
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        />
        <Tool
          label="Inline code"
          icon={<Code2 className={icon} />}
          active={editor.isActive("code")}
          onClick={() => editor.chain().focus().toggleCode().run()}
        />

        <span className="mx-1 w-px bg-border" aria-hidden />

        {/* Level 1 is absent on purpose: the page's h1 is the post title. */}
        <Tool
          label="Heading 2"
          icon={<Heading2 className={icon} />}
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        />
        <Tool
          label="Heading 3"
          icon={<Heading3 className={icon} />}
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        />

        <span className="mx-1 w-px bg-border" aria-hidden />

        <Tool
          label="Bullet list"
          icon={<List className={icon} />}
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        />
        <Tool
          label="Numbered list"
          icon={<ListOrdered className={icon} />}
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        />
        <Tool
          label="Task list"
          icon={<ListTodo className={icon} />}
          active={editor.isActive("taskList")}
          onClick={() => editor.chain().focus().toggleTaskList().run()}
        />
        <Tool
          label="Quote"
          icon={<Quote className={icon} />}
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        />
        <Tool
          label="Code block"
          // A different glyph from inline code: two controls sharing an icon is two
          // controls a hurried author will confuse.
          icon={<Braces className={icon} />}
          active={editor.isActive("codeBlock")}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        />
        <Tool
          label="Table"
          icon={<TableIcon className={icon} />}
          disabled={editor.isActive("table") || !editor.can().insertTable()}
          onClick={() =>
            editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
          }
        />

        <span className="mx-1 w-px bg-border" aria-hidden />

        <Tool
          label={editor.isActive("link") ? "Remove link" : "Add link"}
          icon={<Link2 className={icon} />}
          active={editor.isActive("link")}
          onClick={() => {
            if (editor.isActive("link")) {
              editor.chain().focus().unsetLink().run()
              return
            }

            const href = window.prompt("Link address")
            if (!href) return

            // Only what the sanitiser would keep anyway. Rejecting it here means the
            // author finds out now rather than discovering a silently dropped link
            // on the published page.
            if (
              !/^https?:\/\//i.test(href) &&
              !href.startsWith("/") &&
              !href.startsWith("mailto:")
            ) {
              window.alert("Links must be http(s), mailto:, or start with /.")
              return
            }

            editor.chain().focus().setLink({ href }).run()
          }}
        />

        <span className="mx-1 w-px bg-border" aria-hidden />

        <Tool
          label="Undo"
          icon={<Undo2 className={icon} />}
          disabled={!editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
        />
        <Tool
          label="Redo"
          icon={<Redo2 className={icon} />}
          disabled={!editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
        />
      </div>
      {editor.isActive("table") && (
        <div className="border-t-2 border-border">
          <div role="toolbar" aria-label="Table editing" className="flex gap-1 overflow-x-auto p-2">
            {TABLE_ACTIONS.map(([command, label, Icon, Badge]) => (
              <Tool
                key={command}
                label={label}
                icon={
                  <span className="relative">
                    <Icon className={icon} aria-hidden />
                    {Badge && (
                      <Badge
                        className="absolute -right-1 -bottom-1 h-2.5 w-2.5 bg-[var(--color-muted)]"
                        strokeWidth={3}
                        aria-hidden
                      />
                    )}
                  </span>
                }
                disabled={!editor.can()[command]()}
                onClick={() => editor.chain().focus()[command]().run()}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * The article editor.
 *
 * Reads `WRITING_EXTENSIONS` - the same list the server renderer reads - so what is
 * written here and what is published cannot describe different schemas.
 *
 * The admin is browser-only. Delaying initialization until the first effect
 * keeps the editor lifecycle aligned with React mounting and its placeholder.
 */
export function PostEditor({ value, onChange }: EditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const header = document.querySelector<HTMLElement>("[data-admin-header]")
    if (!header) return

    const updateOffset = () => {
      containerRef.current?.style.setProperty(
        "--admin-header-height",
        `${header.getBoundingClientRect().height}px`
      )
    }
    const observer = new ResizeObserver(updateOffset)
    observer.observe(header)
    updateOffset()
    return () => observer.disconnect()
  }, [])

  const editor = useEditor({
    extensions: WRITING_EXTENSIONS,
    content: value ?? EMPTY_DOCUMENT,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "prose prose-lg max-w-none min-h-[24rem] px-4 py-4 focus:outline-none focus-visible:outline-none",
        "aria-label": "Article body",
      },
    },
    onUpdate: ({ editor: instance }) => onChange(instance.getJSON() as PostDocument),
  })

  if (!editor) {
    // Reserves the same height the editor will occupy, so the form does not jump
    // when it mounts.
    return (
      <div ref={containerRef} className="min-h-[28rem] border-2 border-border bg-card" aria-busy>
        <span className="sr-only">Loading the editor</span>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="min-w-0 border-2 border-border bg-card">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  )
}
