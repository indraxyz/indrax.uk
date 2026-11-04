import type { Editor } from "@tiptap/react"
import { Video } from "lucide-react"
import { useId, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { controlClassNames, fieldClassNames } from "@/components/ui/variants"
import { normalizeYouTubeUrl } from "@/features/writing/editor/video-url"
import { moveAfterInsertedMedia, runMediaAction } from "@/features/writing/editor/media-commands"
import { cn } from "@/lib/utils"

export function EditorVideo({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [url, setUrl] = useState("")
  const [title, setTitle] = useState("")
  const [fullWidth, setFullWidth] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bookmark = useRef(editor.state.selection.getBookmark())
  const trigger = useRef<HTMLButtonElement>(null)
  const submitted = useRef(false)
  const id = useId()
  const active = editor.isActive("youtube")

  const restore = () =>
    !editor.isDestroyed &&
    editor.commands.command(({ tr }) => {
      tr.setSelection(bookmark.current.resolve(tr.doc))
      return true
    })
  const apply = () => {
    const src = normalizeYouTubeUrl(url)
    if (!src) {
      setError("Use a valid YouTube watch, share, Shorts or embed link.")
      return
    }
    if (!title.trim()) {
      setError("Add a video title to describe the player for readers.")
      return
    }
    if (!restore()) return
    const applied = runMediaAction(editor, (chain) =>
      editing
        ? chain.updateAttributes("youtube", { src, title: title.trim(), fullWidth })
        : chain
            .insertContent({ type: "youtube", attrs: { src, title: title.trim(), fullWidth } })
            .command(moveAfterInsertedMedia)
    )
    if (!applied) {
      setError("A video cannot be placed here. Choose a paragraph and try again.")
      return
    }
    submitted.current = true
    setOpen(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          bookmark.current = editor.state.selection.getBookmark()
          const selected = editor.isActive("youtube")
          const attrs = selected ? editor.getAttributes("youtube") : {}
          setEditing(selected)
          setUrl(typeof attrs.src === "string" ? attrs.src : "")
          setTitle(typeof attrs.title === "string" ? attrs.title : "YouTube video player")
          setFullWidth(attrs.fullWidth === true)
          setError(null)
          submitted.current = false
        }
        setOpen(next)
      }}
    >
      <DialogTrigger
        ref={trigger}
        type="button"
        aria-label={active ? "Edit video" : "Insert video"}
        title={active ? "Edit video" : "Insert video"}
        className={cn(
          controlClassNames,
          "size-11 shrink-0 justify-center p-0",
          active && "bg-[var(--color-accent)] text-[var(--color-accent-foreground)]"
        )}
      >
        <Video className="size-4" aria-hidden />
      </DialogTrigger>
      <DialogContent finalFocus={() => (submitted.current ? editor.view.dom : trigger.current)}>
        <DialogTitle>{editing ? "Edit video" : "Insert video"}</DialogTitle>
        <DialogDescription className="mt-2">
          Embed a YouTube video between content blocks. Save the post to keep your changes.
        </DialogDescription>
        <form
          className="mt-5 space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            event.stopPropagation()
            apply()
          }}
        >
          <div className="space-y-1.5">
            <label htmlFor={`${id}-url`} className="text-sm font-bold">
              Video URL
            </label>
            <input
              id={`${id}-url`}
              type="url"
              value={url}
              onChange={(event) => {
                setUrl(event.target.value)
                setError(null)
              }}
              placeholder="https://www.youtube.com/watch?v=…"
              className={fieldClassNames}
              aria-describedby={`${id}-help`}
              aria-invalid={Boolean(error)}
            />
            <p id={`${id}-help`} className="text-xs text-muted-foreground">
              YouTube watch, share, Shorts and embed links are supported. Playback starts only when
              the reader chooses.
            </p>
          </div>
          <div className="space-y-1.5">
            <label htmlFor={`${id}-title`} className="text-sm font-bold">
              Video title
            </label>
            <input
              id={`${id}-title`}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={200}
              className={fieldClassNames}
            />
            <p className="text-xs text-muted-foreground">
              Describe the video so readers can identify the player.
            </p>
          </div>
          <label className="flex cursor-pointer items-center gap-3 text-sm font-bold">
            <input
              type="checkbox"
              checked={fullWidth}
              onChange={(event) => setFullWidth(event.target.checked)}
              className="size-5 accent-[var(--color-accent)]"
            />
            Full content width
          </label>
          <p className="text-xs text-muted-foreground">
            Height adjusts automatically to preserve the video’s proportions. You can also drag the
            frame’s corner handles after inserting it.
          </p>
          {error && (
            <p role="alert" className="text-sm font-bold text-destructive">
              {error}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            {editing && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  if (!restore()) return
                  runMediaAction(editor, (chain) => chain.deleteSelection())
                  submitted.current = true
                  setOpen(false)
                }}
              >
                Remove video
              </Button>
            )}
            <DialogClose render={<Button type="button" variant="secondary" />}>Cancel</DialogClose>
            <Button type="submit" disabled={!url.trim()}>
              {editing ? "Update video" : "Insert video"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
