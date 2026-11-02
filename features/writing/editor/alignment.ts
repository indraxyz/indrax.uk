import { TextAlign } from "@tiptap/extension-text-align"
import { NodeSelection } from "@tiptap/pm/state"

export const CONTENT_ALIGNMENTS = ["left", "center", "right", "justify"] as const
export const MEDIA_ALIGNMENTS = ["left", "center", "right"] as const
const TEXT_TYPES = ["paragraph", "heading", "tableCell", "tableHeader"]
const MEDIA_TYPES = ["image", "youtube"]

/** Persist only named alignments; arbitrary style strings never enter rendered markup. */
export function contentAlignment(value: unknown, media = false): string | null {
  const allowed: readonly string[] = media ? MEDIA_ALIGNMENTS : CONTENT_ALIGNMENTS
  return typeof value === "string" && allowed.includes(value) ? value : null
}

/** Keep Tiptap's command/shortcut API while rendering sanitizer-safe attributes. */
export const ContentAlignment = TextAlign.extend({
  addGlobalAttributes() {
    return [TEXT_TYPES, MEDIA_TYPES].map((types, index) => ({
      types,
      attributes: {
        textAlign: {
          default: null,
          parseHTML: (element: HTMLElement) =>
            contentAlignment(
              element.getAttribute("data-align") ??
                (index === 1 ? element.parentElement?.getAttribute("data-align") : null) ??
                element.style.textAlign,
              index === 1
            ),
          renderHTML: (attributes: Record<string, unknown>) => {
            const alignment = contentAlignment(attributes.textAlign, index === 1)
            return alignment ? { "data-align": alignment } : {}
          },
        },
      },
    }))
  },

  addCommands() {
    return {
      ...this.parent?.(),
      setTextAlign:
        (alignment: string) =>
        ({ commands, state }) => {
          if (!contentAlignment(alignment)) return false
          const selectedMedia =
            state.selection instanceof NodeSelection &&
            MEDIA_TYPES.includes(state.selection.node.type.name)
          if (alignment === "justify" && selectedMedia) return false
          // A mixed selection may justify its text while keeping media placement.
          const types = alignment === "justify" ? TEXT_TYPES : this.options.types
          return types
            .map((type) => commands.updateAttributes(type, { textAlign: alignment }))
            .some(Boolean)
        },
    }
  },
}).configure({ types: [...TEXT_TYPES, ...MEDIA_TYPES], alignments: [...CONTENT_ALIGNMENTS] })
