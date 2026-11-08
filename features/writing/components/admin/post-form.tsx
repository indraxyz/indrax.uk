import { LoadingIndicator } from "@/components/ui/loading-indicator"
import { AlertTriangle, Save, X } from "lucide-react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useBeforeUnload, useBlocker, useNavigate } from "react-router"
import {
  lazy,
  Suspense,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field"
import { PostStatusDialog } from "./post-status-dialog"
import { controlClassNames, fieldClassNames } from "@/components/ui/variants"
import { ImageUpload } from "@/features/writing/components/admin/image-upload"
import { WRITING_CONFIG } from "@/features/writing/config"
import { adminApi, adminKeys } from "@/features/writing/api/client"
import { cachePostMutation, invalidatePostCollections } from "@/features/writing/api/mutation-cache"
import { api, apiErrorMessage } from "@/lib/api-client"
import type { ActionResult } from "@/features/writing/types"
import {
  POST_STATUSES,
  type AdminPost,
  type PostDocument,
  type PostStatus,
} from "@/features/writing/types"
import {
  createPostFormFields,
  postFormSnapshot,
  reconcilePostStatus,
  reconcileSavedFields,
  type PostFormFields,
} from "@/features/writing/utils/post-form-state"
import {
  AUTOSAVE_INTERVAL_MS,
  canAutosave,
  postFormInput,
} from "@/features/writing/utils/post-autosave"
import { slugify } from "@/features/writing/utils/slug"
import { cn, isAllowedMediaUrl } from "@/lib/utils"

// The editor is browser-only and split from dashboard/list routes.
const PostEditor = lazy(() => import("./editor").then((mod) => ({ default: mod.PostEditor })))

const fieldClasses = cn(fieldClassNames, "font-medium")

const labelClasses = "text-xs font-black uppercase tracking-[0.14em] text-muted-foreground"

interface PostFormProps {
  post: AdminPost | null
  coverUploadsConfigured: boolean
  children: (controls: {
    form: ReactNode
    saveButton: ReactNode
    onDeleted: () => void
    hasUnsavedChanges: boolean
    isSaving: boolean
    onRefresh: () => void
    onActionsBusyChange: (busy: boolean) => void
  }) => ReactNode
}

/**
 * A field-level message, tied to the field it belongs to.
 *
 * The `id` matters as much as the text: without `aria-describedby` pointing at it
 * from the input, someone tabbing back to a rejected field is told nothing at all
 * about why it was rejected. `role="alert"` announces it once, on arrival; the
 * association is what makes it findable afterwards.
 */
function FieldError({ id, messages }: { id: string; messages?: string[] }) {
  if (!messages?.length) return null

  return (
    <p
      id={id}
      role="alert"
      className="text-xs font-black uppercase tracking-[0.14em] text-destructive"
    >
      {messages[0]}
    </p>
  )
}

/** Wires an input to its error message, or to nothing when there is none. */
const describedBy = (field: string, messages?: string[]) =>
  messages?.length ? { "aria-invalid": true, "aria-describedby": `${field}-error` } : {}

export function PostForm({ post, coverUploadsConfigured, children }: PostFormProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const save = useMutation({ mutationFn: adminApi.savePost })
  const [pending, startTransition] = useTransition()
  const [refreshing, setRefreshing] = useState(false)
  const refreshingRef = useRef(false)
  const [refreshConfirmationOpen, setRefreshConfirmationOpen] = useState(false)
  const [editorGeneration, setEditorGeneration] = useState(0)
  const actionsBusy = useRef(false)
  const autosaveTick = useRef<() => void>(() => {})
  const formId = useId()
  const saveStatusId = `${formId}-save-status`
  const initial = createPostFormFields(post)
  const [fields, setFields] = useState(initial)
  const [savedFields, setSavedFields] = useState(initial)
  const [selectedCover, setSelectedCover] = useState<File | null>(null)
  const selectedCoverRef = useRef<File | null>(null)
  const [localPreview, setLocalPreview] = useState<string | null>(null)
  useEffect(() => {
    if (!selectedCover) return
    const url = URL.createObjectURL(selectedCover)
    setLocalPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [selectedCover])
  const currentFields = useRef(fields)
  const slugSelection = useRef<{
    input: HTMLInputElement
    value: string
    start: number
    end: number
  } | null>(null)
  const savedFieldsRef = useRef(savedFields)
  const savedId = useRef(post?.id)
  const [persistedId, setPersistedId] = useState(post?.id)
  const saving = useRef(false)
  const syncedStatus = useRef(post?.status)
  const [coverRemovalOpen, setCoverRemovalOpen] = useState(false)
  const [statusConfirmationOpen, setStatusConfirmationOpen] = useState(false)
  const [result, setResult] = useState<ActionResult | null>(null)
  // Restore normalized input selection in the same commit, before another
  // keystroke. Animation-frame callbacks can run after subsequent typing.
  useLayoutEffect(() => {
    const selection = slugSelection.current
    slugSelection.current = null
    if (
      selection &&
      document.activeElement === selection.input &&
      selection.input.value === selection.value
    )
      selection.input.setSelectionRange(selection.start, selection.end)
  })
  const dirty = Boolean(selectedCover) || postFormSnapshot(fields) !== postFormSnapshot(savedFields)
  const isDirty = () =>
    Boolean(selectedCoverRef.current) ||
    postFormSnapshot(currentFields.current) !== postFormSnapshot(savedFieldsRef.current)
  const blocker = useBlocker(isDirty)
  useBeforeUnload((event) => {
    if (isDirty()) {
      event.preventDefault()
      event.returnValue = ""
    }
  })
  useEffect(() => {
    if (blocker.state === "blocked") {
      if (window.confirm("Leave this page? Your unsaved changes will be lost.")) blocker.proceed()
      else blocker.reset()
    }
  }, [blocker])

  function updateFields(patch: Partial<PostFormFields>) {
    const next = { ...currentFields.current, ...patch }
    currentFields.current = next
    setFields(next)
    if (result?.ok === false) setResult(null)
  }
  const persistedStatus = post?.status
  useEffect(() => {
    if (!pending && persistedStatus && persistedStatus !== syncedStatus.current) {
      syncedStatus.current = persistedStatus
      // A menu status request can finish while the author edits another field.
      // Acknowledge its persisted status without losing those edits or an
      // independently selected status, so Save cannot silently reverse it.
      const reconciled = reconcilePostStatus(
        currentFields.current,
        savedFieldsRef.current,
        persistedStatus
      )
      currentFields.current = reconciled.current
      savedFieldsRef.current = reconciled.saved
      setFields(currentFields.current)
      setSavedFields(savedFieldsRef.current)
    }
  }, [persistedStatus, pending])

  const {
    title,
    slug,
    excerpt,
    status,
    tags,
    coverUrl,
    coverAlt,
    body,
    seriesTitle,
    seriesDescription,
    seriesOrder,
  } = fields
  const setTitle = (title: string) => updateFields({ title })
  const setSlug = (slug: string) => updateFields({ slug })
  const setExcerpt = (excerpt: string) => updateFields({ excerpt })
  const setStatus = (status: PostStatus) => updateFields({ status })
  const setTags = (tags: string) => updateFields({ tags })
  const selectCover = (file: File | null) => {
    selectedCoverRef.current = file
    setSelectedCover(file)
    setLocalPreview(null)
    if (result?.ok === false) setResult(null)
  }
  const setCoverUrl = (coverUrl: string) => {
    selectCover(null)
    updateFields({ coverUrl })
  }
  const coverPreview = selectedCover ? localPreview : isAllowedMediaUrl(coverUrl) ? coverUrl : null
  const setCoverAlt = (coverAlt: string) => updateFields({ coverAlt })
  const setBody = (body: PostDocument) => updateFields({ body })
  const setSeriesTitle = (seriesTitle: string) => updateFields({ seriesTitle })
  const setSeriesDescription = (seriesDescription: string) => updateFields({ seriesDescription })
  const setSeriesOrder = (seriesOrder: string) => updateFields({ seriesOrder })

  // Changing the address of something already published breaks every link to it
  // that exists in the world. Worth saying out loud, at the moment it is being
  // done, rather than in a changelog afterwards (PRD US-3.2).
  const slugWillBreakLinks =
    post?.status === "published" && slugify(slug).length > 0 && slugify(slug) !== post.slug

  const submit = () => {
    if (saving.current || refreshingRef.current) return
    saving.current = true
    // Enter can submit before another blur. Save and acknowledge the canonical
    // slug visible in the form rather than the trailing separator being typed.
    const submitted = {
      ...currentFields.current,
      slug: slugify(currentFields.current.slug),
    }
    const file = selectedCoverRef.current
    updateFields(submitted)
    setResult(null)
    startTransition(async () => {
      try {
        if (file) {
          const response = await api.post("/api/upload", {
            searchParams: { purpose: "cover" },
            headers: { "content-type": file.type },
            body: file,
            throwHttpErrors: (status) => status === 401 || status === 403,
            timeout: 120_000,
          })
          if (!response.ok) {
            const error = await response
              .json<{ error?: string }>()
              .catch(() => ({ error: undefined }))
            setResult({
              ok: false,
              message: error.error ?? "That upload was refused. Please try saving again.",
            })
            return
          }
          const { publicUrl } = await response.json<{ publicUrl: string }>()
          submitted.coverUrl = publicUrl
          // Keep the successful upload for a retry if saving the post fails.
          if (selectedCoverRef.current === file) {
            selectCover(null)
            updateFields({ coverUrl: publicUrl })
          }
        }
        const outcome = await save.mutateAsync(postFormInput(submitted, savedId.current))
        setResult(outcome)
        if (!outcome.ok) return
        setStatusConfirmationOpen(false)
        const canonical = outcome.post ? createPostFormFields(outcome.post) : submitted
        currentFields.current = reconcileSavedFields(currentFields.current, submitted, canonical)
        savedFieldsRef.current = canonical
        if (outcome.post) syncedStatus.current = canonical.status
        setFields(currentFields.current)
        setSavedFields(canonical)
        cachePostMutation(queryClient, outcome)
        if (outcome.postId) {
          savedId.current = outcome.postId
          setPersistedId(outcome.postId)
        }
        await Promise.all([
          // Older deployed responses may not carry the snapshot yet.
          ...(!outcome.post && savedId.current
            ? [queryClient.invalidateQueries({ queryKey: adminKeys.post(savedId.current) })]
            : []),
          invalidatePostCollections(queryClient),
        ])
        // An author can keep editing while a request runs. Retain those fields
        // and the created ID; the next save updates that post without losing edits.
        if (outcome.postId && outcome.postId !== post?.id && !isDirty())
          navigate(`/admin/posts/edit/${outcome.postId}`, { replace: true })
      } catch (error) {
        setResult({ ok: false, message: apiErrorMessage(error) })
      } finally {
        saving.current = false
      }
    })
  }

  async function refreshPost() {
    if (!savedId.current || saving.current || refreshingRef.current) return
    refreshingRef.current = true
    setRefreshing(true)
    setRefreshConfirmationOpen(false)
    setResult(null)
    try {
      const fresh = await adminApi.post(savedId.current)
      const next = createPostFormFields(fresh)
      currentFields.current = next
      savedFieldsRef.current = next
      syncedStatus.current = fresh.status
      setFields(next)
      setSavedFields(next)
      selectCover(null)
      setEditorGeneration((value) => value + 1)
      queryClient.setQueryData(adminKeys.post(fresh.id), fresh)
    } catch (error) {
      setResult({ ok: false, message: apiErrorMessage(error) })
    } finally {
      refreshingRef.current = false
      setRefreshing(false)
    }
  }

  // Keep the interval stable while reading the latest fields and dialog state.
  useLayoutEffect(() => {
    autosaveTick.current = () => {
      if (
        saving.current ||
        refreshingRef.current ||
        actionsBusy.current ||
        refreshConfirmationOpen ||
        statusConfirmationOpen ||
        coverRemovalOpen
      )
        return
      if (
        canAutosave(
          currentFields.current,
          savedFieldsRef.current,
          Boolean(selectedCoverRef.current)
        )
      )
        submit()
    }
  })
  useEffect(() => {
    const timer = window.setInterval(() => autosaveTick.current(), AUTOSAVE_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [])

  const saveButton = (
    <button
      type="submit"
      data-slot="button"
      form={formId}
      disabled={pending || refreshing || (!dirty && Boolean(persistedId))}
      aria-describedby={saveStatusId}
      className={cn(
        controlClassNames,
        "variant-primary relative min-h-11 justify-center whitespace-nowrap bg-[var(--variant-bg)] px-3 py-2 text-[var(--variant-fg)] hover:bg-[var(--variant-hover)] disabled:opacity-60"
      )}
    >
      {pending ? <LoadingIndicator /> : <Save className="h-3.5 w-3.5" aria-hidden />}
      {pending ? "Saving" : !dirty && persistedId ? "Saved" : "Save"}
      {dirty && (
        <span
          data-unsaved-changes
          aria-hidden
          className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[var(--component-status-unsaved)]"
        />
      )}
    </button>
  )
  const form = (
    <form
      id={formId}
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault()
        const nextStatus = currentFields.current.status
        const previousStatus = savedFieldsRef.current.status
        if (
          nextStatus !== previousStatus &&
          (nextStatus === "published" || previousStatus === "published")
        ) {
          setStatusConfirmationOpen(true)
        } else submit()
      }}
    >
      <span id={saveStatusId} role="status" aria-live="polite" className="sr-only">
        {pending
          ? "Saving changes"
          : dirty
            ? "Unsaved changes"
            : persistedId
              ? "All changes saved"
              : "No unsaved changes"}
      </span>
      <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
        {refreshing
          ? "Refreshing post…"
          : pending
            ? "Saving changes…"
            : fields.status !== savedFields.status
              ? "Save manually to confirm the status change."
              : fields.status !== "draft"
                ? "Autosave is for drafts only. Save changes manually."
                : dirty
                  ? "Unsaved changes. Valid draft changes save automatically every minute."
                  : persistedId
                    ? "All changes saved. Draft autosave checks every minute."
                    : "Valid draft changes save automatically every minute."}
      </p>
      <AlertDialog open={refreshConfirmationOpen} onOpenChange={setRefreshConfirmationOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes and refresh?</AlertDialogTitle>
            <AlertDialogDescription>
              Replace your unsaved changes with the latest saved post. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void refreshPost()}>
              Discard and refresh
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <PostStatusDialog
        open={statusConfirmationOpen}
        onOpenChange={setStatusConfirmationOpen}
        targetStatus={status}
        title={title.trim() || "Untitled post"}
        pending={pending}
        error={result?.ok === false ? result.message : null}
        onConfirm={submit}
      />
      <AlertDialog open={coverRemovalOpen} onOpenChange={setCoverRemovalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove cover image?</AlertDialogTitle>
            <AlertDialogDescription>
              The cover will be removed when you save. Its stored image will also be deleted if no
              other post uses it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                selectCover(null)
                updateFields({ coverUrl: "", coverAlt: "" })
                setCoverRemovalOpen(false)
              }}
            >
              Remove cover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {result?.ok === false && result.message && !statusConfirmationOpen && (
        <p
          role="alert"
          className="flex items-center gap-2 border-2 border-destructive bg-[var(--component-variant-destructive-soft)] px-4 py-3 text-sm font-black uppercase tracking-[0.14em] text-destructive"
        >
          <AlertTriangle className="h-4 w-4" aria-hidden />
          {result.message}
        </p>
      )}

      <fieldset
        disabled={refreshing}
        inert={refreshing}
        className="min-w-0 border-0 p-0"
        aria-busy={refreshing}
      >
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="min-w-0 space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="title" className={labelClasses}>
                Title
              </label>
              <input
                id="title"
                {...describedBy("title", result?.errors?.title)}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                onBlur={() => {
                  // Only ever fills an empty slug. Silently rewriting one that
                  // already exists would change a published URL as a side effect of
                  // an unrelated edit.
                  if (!slug && title) setSlug(slugify(title))
                }}
                className={cn(fieldClasses, "text-lg font-black")}
                required
              />
              <FieldError id="title-error" messages={result?.errors?.title} />
            </div>

            <Suspense
              fallback={
                <div className="min-h-[28rem] border-2 border-border bg-card" aria-busy>
                  <span className="sr-only">Loading the editor</span>
                </div>
              }
            >
              <PostEditor
                key={editorGeneration}
                value={body}
                imageUploadsConfigured={coverUploadsConfigured}
                onChange={(value) => {
                  setBody(value)
                }}
              />
            </Suspense>
            <FieldError id="content-error" messages={result?.errors?.content} />
          </div>

          <div className="min-w-0 space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="status" className={labelClasses}>
                Status
              </label>
              <select
                id="status"
                value={status}
                onChange={(event) => setStatus(event.target.value as PostStatus)}
                className={fieldClasses}
              >
                {POST_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="slug" className={labelClasses}>
                Slug
              </label>
              <input
                id="slug"
                {...describedBy("slug", result?.errors?.slug)}
                aria-describedby={[
                  "slug-help",
                  result?.errors?.slug?.length ? "slug-error" : null,
                  slugWillBreakLinks ? "slug-warning" : null,
                ]
                  .filter(Boolean)
                  .join(" ")}
                value={slug}
                onChange={(event) => {
                  const input = event.currentTarget
                  const raw = input.value
                  const normalized = slugify(raw, { preserveTrailingSeparator: true })
                  const start = input.selectionStart
                  const end = input.selectionEnd
                  if (
                    raw !== normalized &&
                    start !== null &&
                    end !== null &&
                    typeof document !== "undefined"
                  ) {
                    slugSelection.current = {
                      input,
                      value: normalized,
                      start: slugify(raw.slice(0, start), { preserveTrailingSeparator: true })
                        .length,
                      end: slugify(raw.slice(0, end), { preserveTrailingSeparator: true }).length,
                    }
                  }
                  setSlug(normalized)
                }}
                placeholder="derived from the title"
                className={cn(fieldClasses, "font-mono")}
              />
              <p id="slug-help" className="text-xs font-medium text-muted-foreground">
                Spaces and punctuation become hyphens as you type.
              </p>
              <FieldError id="slug-error" messages={result?.errors?.slug} />
              {slugWillBreakLinks && (
                <div
                  id="slug-warning"
                  className="space-y-2 border-2 border-border bg-[var(--color-muted)] px-3 py-2 text-xs font-semibold leading-relaxed"
                >
                  <p className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span>
                      This post is published. Changing its slug breaks every existing link to
                    </span>
                  </p>
                  <p className="break-words font-mono">
                    {WRITING_CONFIG.basePath}/{post?.slug}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="tags" className={labelClasses}>
                Tags
              </label>
              <input
                id="tags"
                {...describedBy("tags", result?.errors?.tags)}
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                placeholder="React Router, TypeScript"
                className={fieldClasses}
              />
              <p className="text-xs font-medium text-muted-foreground">
                Comma separated. Matching ignores case and punctuation.
              </p>
              <FieldError id="tags-error" messages={result?.errors?.tags} />
            </div>

            <fieldset className="space-y-1.5 border-2 border-border p-3">
              <legend className={`${labelClasses} px-1`}>Series</legend>

              <label htmlFor="seriesTitle" className="sr-only">
                Series title
              </label>
              <input
                id="seriesTitle"
                {...describedBy("seriesTitle", result?.errors?.seriesTitle)}
                value={seriesTitle}
                onChange={(event) => setSeriesTitle(event.target.value)}
                placeholder="Building this site"
                className={fieldClasses}
              />
              <FieldError id="seriesTitle-error" messages={result?.errors?.seriesTitle} />

              <label htmlFor="seriesOrder" className="sr-only">
                Part number
              </label>
              <input
                id="seriesOrder"
                type="number"
                min={1}
                max={999}
                {...describedBy("seriesOrder", result?.errors?.seriesOrder)}
                value={seriesOrder}
                onChange={(event) => setSeriesOrder(event.target.value)}
                placeholder="Part number"
                className={fieldClasses}
              />
              <FieldError id="seriesOrder-error" messages={result?.errors?.seriesOrder} />

              <label htmlFor="seriesDescription" className="sr-only">
                Series description
              </label>
              <textarea
                id="seriesDescription"
                {...describedBy("seriesDescription", result?.errors?.seriesDescription)}
                value={seriesDescription}
                onChange={(event) => setSeriesDescription(event.target.value)}
                rows={2}
                placeholder="Series description (optional)"
                className={fieldClasses}
              />
              <FieldError
                id="seriesDescription-error"
                messages={result?.errors?.seriesDescription}
              />

              <p className="text-xs font-medium text-muted-foreground">
                Both or neither. Matching ignores case and punctuation, so retyping the title
                slightly joins the same series rather than starting a second one.
              </p>
            </fieldset>

            <div className="space-y-1.5">
              <label htmlFor="excerpt" className={labelClasses}>
                Excerpt
              </label>
              <textarea
                id="excerpt"
                {...describedBy("excerpt", result?.errors?.excerpt)}
                value={excerpt}
                onChange={(event) => setExcerpt(event.target.value)}
                rows={4}
                placeholder="derived from the body"
                className={fieldClasses}
              />
              <FieldError id="excerpt-error" messages={result?.errors?.excerpt} />
            </div>

            <FieldSet
              disabled={!coverUploadsConfigured || pending}
              aria-describedby={!coverUploadsConfigured ? "cover-storage-help" : undefined}
              className="min-w-0 border-2 border-border p-3 disabled:[&_input]:opacity-60 disabled:[&_button]:opacity-60"
            >
              <FieldLegend variant="label" className={labelClasses}>
                Cover image
              </FieldLegend>
              <FieldGroup className="min-w-0 gap-4">
                <Field className="gap-1.5">
                  {coverPreview && (
                    <div className="relative w-full border-2 border-border bg-card">
                      <img
                        src={coverPreview}
                        alt={coverAlt || "Cover preview"}
                        className="block h-auto w-full"
                      />
                      <button
                        type="button"
                        aria-label="Remove cover image"
                        title="Remove cover image"
                        onClick={() => setCoverRemovalOpen(true)}
                        className={cn(
                          controlClassNames,
                          "absolute right-2 top-2 h-11 w-11 shrink-0 justify-center bg-card p-0"
                        )}
                      >
                        <X className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  )}
                  {selectedCover && (
                    <p
                      role="status"
                      className="break-words text-xs font-medium text-muted-foreground"
                    >
                      Selected: {selectedCover.name}
                    </p>
                  )}
                  {coverUploadsConfigured && (
                    <p className="text-xs font-medium text-muted-foreground">
                      Cover changes take effect when you save the post.
                    </p>
                  )}
                  {!coverUploadsConfigured && (
                    <p
                      id="cover-storage-help"
                      className="text-xs font-medium text-muted-foreground"
                    >
                      Cover images are unavailable until media storage is configured. Existing cover
                      details are kept when you save.
                    </p>
                  )}
                </Field>
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="coverUrl" className={labelClasses}>
                    Cover image URL
                  </FieldLabel>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                    <input
                      id="coverUrl"
                      {...describedBy("coverUrl", result?.errors?.coverUrl)}
                      value={coverUrl}
                      onChange={(event) => setCoverUrl(event.target.value)}
                      placeholder="https://..."
                      className={cn(fieldClasses, "min-h-11 min-w-0 font-mono text-xs")}
                    />
                    <ImageUpload onSelected={(file) => selectCover(file)} />
                  </div>
                  <FieldError id="coverUrl-error" messages={result?.errors?.coverUrl} />
                </Field>
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="coverAlt" className={labelClasses}>
                    Cover alt text
                  </FieldLabel>
                  <input
                    id="coverAlt"
                    {...describedBy("coverAlt", result?.errors?.coverAlt)}
                    value={coverAlt}
                    onChange={(event) => setCoverAlt(event.target.value)}
                    className={fieldClasses}
                  />
                  <FieldError id="coverAlt-error" messages={result?.errors?.coverAlt} />
                </Field>
              </FieldGroup>
            </FieldSet>
          </div>
        </div>
      </fieldset>
    </form>
  )
  return children({
    form,
    saveButton,
    hasUnsavedChanges: dirty,
    isSaving: pending || refreshing,
    onActionsBusyChange: (busy) => {
      actionsBusy.current = busy
    },
    onRefresh: () => {
      if (saving.current || refreshingRef.current) return
      if (isDirty()) setRefreshConfirmationOpen(true)
      else void refreshPost()
    },
    onDeleted: () => {
      savedFieldsRef.current = currentFields.current
      setSavedFields(currentFields.current)
    },
  })
}
