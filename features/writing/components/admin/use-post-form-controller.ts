import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useBeforeUnload, useBlocker, useNavigate } from "react-router"
import { adminApi, adminKeys } from "@/features/writing/api/client"
import { cachePostMutation, invalidatePostCollections } from "@/features/writing/api/mutation-cache"
import { api, apiErrorMessage } from "@/lib/api-client"
import type { ActionResult, AdminPost } from "@/features/writing/types"
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

/** One mounted editor owns one controller; routes reset it with the post ID key. */
export interface PostFormController {
  fields: PostFormFields
  savedFields: PostFormFields
  selectedCover: File | null
  persistedId: string | undefined
  result: ActionResult | null
  pending: boolean
  refreshing: boolean
  dirty: boolean
  editorGeneration: number
  refreshConfirmationOpen: boolean
  statusConfirmationOpen: boolean
  coverRemovalOpen: boolean
  setRefreshConfirmationOpen: (open: boolean) => void
  setStatusConfirmationOpen: (open: boolean) => void
  setCoverRemovalOpen: (open: boolean) => void
  updateFields: (patch: Partial<PostFormFields>) => void
  selectCover: (file: File | null) => void
  requestSubmit: () => void
  submit: () => void
  refreshPost: () => Promise<void>
  onRefresh: () => void
  onDeleted: () => void
  onActionsBusyChange: (busy: boolean) => void
}

/**
 * Owns the working draft and asynchronous authoring coordination, not server cache
 * or Tiptap state. Confirmation flags live here because they gate the autosave
 * interval; the form owns their DOM, focus, and the selected-file preview lifecycle.
 */
export function usePostFormController(post: AdminPost | null): PostFormController {
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
  const initial = createPostFormFields(post)
  const [fields, setFields] = useState(initial)
  const [savedFields, setSavedFields] = useState(initial)
  const [selectedCover, setSelectedCover] = useState<File | null>(null)
  const selectedCoverRef = useRef<File | null>(null)
  const currentFields = useRef(fields)
  const savedFieldsRef = useRef(savedFields)
  const savedId = useRef(post?.id)
  const [persistedId, setPersistedId] = useState(post?.id)
  const saving = useRef(false)
  const syncedStatus = useRef(post?.status)
  const [coverRemovalOpen, setCoverRemovalOpen] = useState(false)
  const [statusConfirmationOpen, setStatusConfirmationOpen] = useState(false)
  const [result, setResult] = useState<ActionResult | null>(null)
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

  const selectCover = (file: File | null) => {
    selectedCoverRef.current = file
    setSelectedCover(file)
    if (result?.ok === false) setResult(null)
  }
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

  return {
    fields,
    savedFields,
    selectedCover,
    persistedId,
    result,
    pending,
    refreshing,
    dirty,
    editorGeneration,
    refreshConfirmationOpen,
    statusConfirmationOpen,
    coverRemovalOpen,
    setRefreshConfirmationOpen,
    setStatusConfirmationOpen,
    setCoverRemovalOpen,
    updateFields,
    selectCover,
    submit,
    refreshPost,
    requestSubmit: () => {
      const nextStatus = currentFields.current.status
      const previousStatus = savedFieldsRef.current.status
      if (
        nextStatus !== previousStatus &&
        (nextStatus === "published" || previousStatus === "published")
      ) {
        setStatusConfirmationOpen(true)
      } else submit()
    },
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
  }
}
