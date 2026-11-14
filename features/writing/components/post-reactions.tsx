import { useEffect, useRef, useState, type ReactNode } from "react"
import { SmilePlus } from "lucide-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { focusControlClassNames } from "@/components/ui/variants"
import { fetchReactions, putReaction, reactionKeys } from "../api/reactions"
import {
  isReactionVisitor,
  REACTIONS,
  REACTION_OPTIONS,
  REACTION_VISITOR_KEY,
  type Reaction,
  type ReactionInput,
} from "../reactions"

/** Reads never create an identifier; only the reader's first reaction does. */
export function readReactionVisitor(): string | null {
  try {
    const value = window.localStorage.getItem(REACTION_VISITOR_KEY)
    return isReactionVisitor(value) ? value : null
  } catch {
    return null
  }
}

function ensureReactionVisitor() {
  const existing = readReactionVisitor()
  if (existing) return existing
  const id = crypto.randomUUID()
  window.localStorage.setItem(REACTION_VISITOR_KEY, id)
  return id
}

/** Own the query, mutation, picker and local focus lifecycle for one article. */
function useReactionControls(slug: string) {
  const client = useQueryClient()
  const [visitorId, setVisitorId] = useState<string | null | undefined>(undefined)
  const [message, setMessage] = useState("")
  const submitting = useRef(false)
  const [open, setOpen] = useState(false)
  const focusOrigin = useRef<{
    button: HTMLButtonElement
    trigger: HTMLButtonElement | null
  } | null>(null)
  const restoreFocus = useRef(false)
  const [storageError, setStorageError] = useState(false)
  useEffect(() => {
    setVisitorId(readReactionVisitor())
    const syncVisitor = (event: StorageEvent) => {
      if (event.key === REACTION_VISITOR_KEY || event.key === null) {
        setVisitorId(readReactionVisitor())
        setMessage("")
        setStorageError(false)
      }
    }
    window.addEventListener("storage", syncVisitor)
    return () => window.removeEventListener("storage", syncVisitor)
  }, [])

  const mutation = useMutation({
    mutationFn: (input: ReactionInput) => putReaction(slug, input),
    onMutate: () => client.cancelQueries({ queryKey: reactionKeys.post(slug) }),
    onSuccess: (summary, input) => {
      client.setQueryData(reactionKeys.visitor(slug, input.visitorId), summary)
      const currentVisitor = readReactionVisitor()
      if (currentVisitor !== input.visitorId)
        void client.invalidateQueries({
          queryKey: reactionKeys.visitor(slug, currentVisitor),
          exact: true,
          refetchType: "none",
        })
      setVisitorId(currentVisitor)
      setMessage(
        `${REACTION_OPTIONS[input.reaction].label} reaction ${input.active ? "added" : "removed"}.`
      )
      restoreFocus.current = !input.active && summary.counts[input.reaction] === 0
    },
    onError: () => setMessage("Your reaction could not be saved. Please try again."),
    onSettled: () => {
      submitting.current = false
    },
  })
  const results = useQuery({
    queryKey: reactionKeys.visitor(slug, visitorId ?? null),
    queryFn: ({ signal }) => fetchReactions(slug, visitorId ?? null, signal),
    enabled: visitorId !== undefined && !mutation.isPending,
  })

  useEffect(() => {
    // Cache notification and mutation settlement must commit before checking
    // whether the focused chip disappeared and returning focus locally.
    if (mutation.isPending || !restoreFocus.current) return
    restoreFocus.current = false
    const source = focusOrigin.current
    const focused = document.activeElement
    if (
      source &&
      (focused === source.button || (!source.button.isConnected && focused === document.body))
    )
      source.trigger?.focus({ preventScroll: true })
  }, [mutation.isPending, results.data])

  function react(reaction: Reaction, button: HTMLButtonElement, trigger: HTMLButtonElement | null) {
    if (!results.data || submitting.current) return
    setOpen(false)
    focusOrigin.current = { button, trigger }
    restoreFocus.current = false
    setStorageError(false)
    try {
      const id = ensureReactionVisitor()
      submitting.current = true
      setMessage("")
      mutation.mutate({
        visitorId: id,
        reaction,
        active: !results.data.selected.includes(reaction),
      })
    } catch {
      setStorageError(true)
      setMessage("Allow site storage to save your reaction, then try again.")
    }
  }

  const visibleReactions = REACTIONS.filter((reaction) => (results.data?.counts[reaction] ?? 0) > 0)
  const error = results.isError
    ? "Reactions could not be loaded."
    : storageError || mutation.isError
      ? message
      : ""
  const status = results.isError
    ? "Reactions could not be loaded."
    : !results.data
      ? "Loading reactions…"
      : message

  return { results, mutation, visibleReactions, error, status, react, open, setOpen }
}

function ReactionGroup({ controls }: { controls: ReturnType<typeof useReactionControls> }) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const { results, mutation, visibleReactions, error, react, open, setOpen } = controls
  return (
    <section
      aria-label="Reader reactions"
      data-reaction-location="header"
      className="min-w-0 max-w-full space-y-2 print:hidden"
    >
      <div
        role="group"
        aria-label="Reaction controls"
        aria-busy={mutation.isPending}
        className="flex flex-wrap items-center gap-1"
      >
        {visibleReactions.map((reaction) => {
          const { emoji, label } = REACTION_OPTIONS[reaction]
          const count = results.data!.counts[reaction]
          const selected = results.data!.selected.includes(reaction)
          return (
            <button
              key={reaction}
              type="button"
              className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 bg-transparent px-2 text-xs font-medium tracking-normal text-muted-foreground hover:text-foreground disabled:opacity-50 ${focusControlClassNames}`}
              aria-label={`${label}: ${count} ${count === 1 ? "reaction" : "reactions"}`}
              title={`${selected ? "Remove your" : "Add"} ${label.toLowerCase()} reaction`}
              aria-pressed={selected}
              disabled={mutation.isPending}
              onClick={(event) => react(reaction, event.currentTarget, triggerRef.current)}
            >
              <span aria-hidden className="text-sm leading-none">
                {emoji}
              </span>
              <span aria-hidden className={selected ? "font-semibold" : undefined}>
                {count.toLocaleString("en-US")}
              </span>
            </button>
          )
        })}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              ref={triggerRef}
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Add reaction"
              title="Add reaction"
              aria-busy={mutation.isPending}
              disabled={!results.data}
            >
              <SmilePlus aria-hidden />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" aria-label="Choose a reaction" className="w-auto p-2">
            <div className="flex flex-wrap gap-1">
              {REACTIONS.map((reaction) => (
                <Button
                  key={reaction}
                  type="button"
                  variant="ghost"
                  className="aria-pressed:border-border aria-pressed:bg-[var(--variant-hover)] [&[aria-pressed=true]>span]:scale-110"
                  appearance="flat"
                  size="icon"
                  aria-label={REACTION_OPTIONS[reaction].label}
                  title={REACTION_OPTIONS[reaction].label}
                  aria-pressed={results.data?.selected.includes(reaction) ?? false}
                  disabled={mutation.isPending}
                  onClick={(event) => react(reaction, event.currentTarget, triggerRef.current)}
                >
                  <span aria-hidden className="text-lg leading-none">
                    {REACTION_OPTIONS[reaction].emoji}
                  </span>
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {results.isError && (
        <Button
          type="button"
          variant="ghost"
          className="h-auto min-h-11 whitespace-normal text-left"
          disabled={results.isFetching}
          onClick={() => void results.refetch()}
        >
          Try loading reactions again
        </Button>
      )}
    </section>
  )
}

export function PostReactions({
  slug,
  children,
}: {
  slug: string
  children: (controls: { header: ReactNode }) => ReactNode
}) {
  const controls = useReactionControls(slug)
  return (
    <>
      {children({
        header: <ReactionGroup controls={controls} />,
      })}
      <span role="status" className="sr-only print:hidden">
        {controls.status}
      </span>
    </>
  )
}
