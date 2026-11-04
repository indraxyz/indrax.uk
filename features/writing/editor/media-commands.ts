import type { ChainedCommands, Command, Editor } from "@tiptap/core"
import { closeHistory } from "@tiptap/pm/history"
import { NodeSelection, Selection } from "@tiptap/pm/state"

/** Explicit media actions stay separate from adjacent typing and other media actions. */
export function runMediaAction(
  editor: Editor,
  action: (chain: ChainedCommands) => ChainedCommands
) {
  const chain = editor
    .chain()
    .focus()
    .command(({ tr }) => {
      closeHistory(tr)
      return true
    })
  const applied = action(chain).run()
  if (applied) editor.view.dispatch(closeHistory(editor.state.tr))
  return applied
}

/** Leave a paragraph ready for typing instead of replacing the inserted media atom. */
export const moveAfterInsertedMedia: Command = ({ tr, editor }) => {
  if (
    tr.selection instanceof NodeSelection &&
    ["image", "youtube"].includes(tr.selection.node.type.name)
  ) {
    const after = tr.selection.to
    if (!tr.doc.nodeAt(after)?.isTextblock) tr.insert(after, editor.schema.nodes.paragraph.create())
    tr.setSelection(Selection.near(tr.doc.resolve(after), 1))
  }
  return true
}
