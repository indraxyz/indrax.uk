import { useEditorState, type Editor } from "@tiptap/react"
import { AlignCenter, AlignJustify, AlignLeft, AlignRight } from "lucide-react"

import { controlClassNames } from "@/components/ui/variants"
import { cn } from "@/lib/utils"

const ALIGNMENTS = [
  ["left", "Align left", AlignLeft],
  ["center", "Align center", AlignCenter],
  ["right", "Align right", AlignRight],
  ["justify", "Justify", AlignJustify],
] as const

export function EditorAlignment({ editor }: { editor: Editor }) {
  useEditorState({ editor, selector: ({ transactionNumber }) => transactionNumber })

  return (
    <>
      {ALIGNMENTS.map(([alignment, label, Icon]) => {
        const active = editor.isActive({ textAlign: alignment })
        return (
          <button
            key={alignment}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={active}
            disabled={!editor.can().setTextAlign(alignment)}
            onClick={() => editor.chain().focus().setTextAlign(alignment).run()}
            className={cn(
              controlClassNames,
              "size-11 shrink-0 justify-center p-0 disabled:opacity-40",
              active && "bg-[var(--color-accent)] text-[var(--color-accent-foreground)]"
            )}
          >
            <Icon className="size-4" aria-hidden />
          </button>
        )
      })}
    </>
  )
}
