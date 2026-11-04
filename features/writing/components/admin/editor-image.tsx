import type { Editor } from "@tiptap/react"
import { ImagePlus } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"

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
import { ImageUpload } from "./image-upload"
import { contentImageUrl } from "@/features/writing/editor/image-url"
import { runMediaAction, moveAfterInsertedMedia } from "@/features/writing/editor/media-commands"
import { api, apiErrorMessage } from "@/lib/api-client"
import { cn } from "@/lib/utils"

interface EditorImageProps {
  editor: Editor
  uploadsConfigured: boolean
}

/** A modal preserves the editor selection while the author describes or uploads an image. */
export function EditorImage({ editor, uploadsConfigured }: EditorImageProps) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [src, setSrc] = useState("")
  const [alt, setAlt] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const selection = useRef(editor.state.selection.getBookmark())
  const trigger = useRef<HTMLButtonElement>(null)
  const submitted = useRef(false)
  const working = useRef(false)
  const id = useId()
  const active = editor.isActive("image")

  useEffect(() => {
    if (!file) return
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => {
      URL.revokeObjectURL(url)
      setPreview(null)
    }
  }, [file])

  const restoreSelection = () => {
    if (editor.isDestroyed) return false
    return editor.commands.command(({ tr }) => {
      tr.setSelection(selection.current.resolve(tr.doc))
      return true
    })
  }

  const apply = async () => {
    if (working.current) return
    const normalized = file ? null : contentImageUrl(src)
    if (!file && !normalized) {
      setError("Use an HTTPS image URL, or upload an image when media storage is available.")
      return
    }
    working.current = true
    setPending(true)
    setError(null)
    try {
      let imageSrc = normalized
      if (file) {
        const response = await api.post("/api/upload", {
          searchParams: { purpose: "content" },
          headers: { "content-type": file.type },
          body: file,
          throwHttpErrors: (status) => status === 401 || status === 403,
          timeout: 120_000,
        })
        if (!response.ok) {
          const result = await response
            .json<{ error?: string }>()
            .catch(() => ({ error: undefined }))
          setError(result.error ?? "That upload was refused. Please try again.")
          return
        }
        const result = await response.json<{ publicUrl: string }>()
        imageSrc = contentImageUrl(result.publicUrl)
        if (!imageSrc) {
          setError("The uploaded image URL is unavailable in this deployment.")
          return
        }
        // Keep the successful upload for a retry if applying the editor command fails.
        setSrc(imageSrc)
        setFile(null)
      }
      if (!imageSrc || !restoreSelection()) return
      const applied = runMediaAction(editor, (chain) =>
        editing
          ? chain.updateAttributes("image", { src: imageSrc, alt })
          : chain.setImage({ src: imageSrc, alt }).command(moveAfterInsertedMedia)
      )
      if (!applied) {
        setError("An image cannot be placed here. Choose a paragraph and try again.")
        return
      }
      submitted.current = true
      setOpen(false)
    } catch (cause) {
      setError(apiErrorMessage(cause))
    } finally {
      working.current = false
      setPending(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen, event) => {
        if (working.current) {
          event.cancel()
          return
        }
        if (nextOpen) {
          selection.current = editor.state.selection.getBookmark()
          const isImage = editor.isActive("image")
          const attrs = isImage ? editor.getAttributes("image") : {}
          setEditing(isImage)
          setSrc(typeof attrs.src === "string" ? (contentImageUrl(attrs.src) ?? attrs.src) : "")
          setAlt(typeof attrs.alt === "string" ? attrs.alt : "")
          setFile(null)
          setError(null)
          submitted.current = false
        }
        setOpen(nextOpen)
      }}
    >
      <DialogTrigger
        ref={trigger}
        type="button"
        aria-label={active ? "Edit image" : "Insert image"}
        title={active ? "Edit image" : "Insert image"}
        className={cn(
          controlClassNames,
          "size-11 shrink-0 justify-center p-0",
          active && "bg-[var(--color-accent)] text-[var(--color-accent-foreground)]"
        )}
      >
        <ImagePlus className="size-4" aria-hidden />
      </DialogTrigger>
      <DialogContent finalFocus={() => (submitted.current ? editor.view.dom : trigger.current)}>
        <div className="space-y-2">
          <DialogTitle>{editing ? "Edit image" : "Insert image"}</DialogTitle>
          <DialogDescription>
            Place an image in the article body. Each image has its own alt text. Save the post
            within 24 hours to keep newly uploaded images.
          </DialogDescription>
        </div>
        <form
          className="mt-5 space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            event.stopPropagation()
            void apply()
          }}
        >
          <div className="space-y-1.5">
            <label htmlFor={`${id}-src`} className="text-sm font-bold">
              Image URL
            </label>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <input
                id={`${id}-src`}
                type="url"
                value={src}
                disabled={pending}
                placeholder="https://…"
                className={cn(fieldClassNames, "min-w-0")}
                aria-describedby={error ? `${id}-error` : `${id}-storage`}
                aria-invalid={Boolean(error)}
                onChange={(event) => {
                  setSrc(event.target.value)
                  setFile(null)
                  setError(null)
                }}
              />
              <ImageUpload
                purpose="content"
                disabled={!uploadsConfigured || pending}
                onSelected={(selected) => {
                  setFile(selected)
                  setSrc("")
                  setError(null)
                }}
              />
            </div>
            <p id={`${id}-storage`} className="text-xs text-muted-foreground">
              {file
                ? `${file.name} — uploads when you insert or update this image.`
                : uploadsConfigured
                  ? "Use an HTTPS URL or upload JPEG, PNG, WebP or AVIF up to 5 MiB."
                  : "Uploads are unavailable until media storage is configured. HTTPS URLs still work."}
            </p>
          </div>
          {preview && (
            <img
              src={preview}
              alt="Selected image preview"
              className="max-h-48 w-full object-contain"
            />
          )}
          <div className="space-y-1.5">
            <label htmlFor={`${id}-alt`} className="text-sm font-bold">
              Image alt text
            </label>
            <input
              id={`${id}-alt`}
              value={alt}
              disabled={pending}
              className={fieldClassNames}
              aria-describedby={`${id}-alt-help`}
              onChange={(event) => setAlt(event.target.value)}
            />
            <p id={`${id}-alt-help`} className="text-xs text-muted-foreground">
              Describe the image for readers who cannot see it. Leave blank for a decorative image.
            </p>
          </div>
          {error && (
            <p id={`${id}-error`} role="alert" className="text-sm font-bold text-destructive">
              {error}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            {editing && (
              <Button
                type="button"
                variant="destructive"
                disabled={pending}
                onClick={() => {
                  if (restoreSelection()) runMediaAction(editor, (chain) => chain.deleteSelection())
                  submitted.current = true
                  setOpen(false)
                }}
              >
                Remove image
              </Button>
            )}
            <DialogClose render={<Button type="button" variant="secondary" disabled={pending} />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={pending || (!file && !src.trim())}>
              {pending ? "Uploading…" : editing ? "Update image" : "Insert image"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
