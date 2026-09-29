import { Image } from "@tiptap/extension-image"
import { TaskItem, TaskList } from "@tiptap/extension-list"
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table"
import { StarterKit } from "@tiptap/starter-kit"

/**
 * The document schema. Both the editor and the renderer read this list, and it is
 * the same list on both sides by construction rather than by discipline.
 *
 * **This is a compatibility surface, not a configuration file.** A stored post is
 * ProseMirror JSON, which only means anything against the extension set that
 * produced it. Remove an extension and every document containing that node stops
 * rendering it - silently, because an unknown node is dropped rather than raised.
 * So: add freely, change or remove only with a migration that rewrites the stored
 * documents first.
 *
 * That property is the cost of storing JSON rather than markdown, and it is why
 * the set lives in one exported constant instead of being assembled at each call
 * site.
 */
export const BLOG_EXTENSIONS = [
  StarterKit.configure({
    heading: {
      // The article's `<h1>` is the post title, rendered by the route. Not offering
      // level 1 in the editor is the cheapest way to keep a body from growing a
      // second one - though `normaliseHeadings` in the render pipeline still
      // guards it, because stored JSON can predate this setting.
      levels: [2, 3, 4],
    },
    link: {
      // Editor behaviour only. `rel` and `target` are deliberately not set here:
      // the sanitiser allows neither on an anchor, so anything stored for them is
      // discarded, and `rehypeExternalLinks` sets them at render instead - where
      // the values are ours rather than the document's.
      openOnClick: false,
    },
  }),
  Table.configure({ resizable: false }),
  TableRow,
  TableHeader,
  TableCell,
  TaskList,
  TaskItem.configure({ nested: false }),
  Image,
]
