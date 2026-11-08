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

/** One query lifecycle supplies the header picker and count chips beside article SSR. */
export function PostReactions({
  slug,
  children,
}: {
  slug: string
  children: (controls: { trigger: ReactNode; summary: ReactNode }) => ReactNode
}) {
  const client = useQueryClient()
  const [visitorId, setVisitorId] = useState<string | null | undefined>(undefined)
  const [message, setMessage] = useState("")
  const submitting = useRef(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const summaryRef = useRef<HTMLElement>(null)
  const [open, setOpen] = useState(false)
  const [storageError, setStorageError] = useState(false)
  useEffect(() => {
    setVisitorId(readReactionVisitor())
    const syncVisitor = (event: StorageEvent) => {
      if (event.key === REACTION_VISITOR_KEY || event.key === null)
        setVisitorId(readReactionVisitor())
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
      if (!input.active && summary.counts[input.reaction] === 0) {
        const focused = document.activeElement
        if (focused === document.body || summaryRef.current?.contains(focused))
          triggerRef.current?.focus({ preventScroll: true })
      }
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

  function react(reaction: Reaction) {
    if (!results.data || submitting.current) return
    setOpen(false)
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
  const error =
    storageError || mutation.isError
      ? message
      : results.isError
        ? "Reactions could not be loaded."
        : ""
  const status =
    message ||
    (results.isError ? "Reactions could not be loaded." : !results.data ? "Loading reactions…" : "")

  const trigger = (
    <span role="group" aria-label="Reaction controls" className="inline-flex print:hidden">
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
        <PopoverContent align="end" aria-label="Choose a reaction" className="w-auto p-2">
          <div className="flex gap-1">
            {REACTIONS.map((reaction) => (
              <Button
                key={reaction}
                type="button"
                variant={results.data?.selected.includes(reaction) ? "secondary" : "ghost"}
                appearance="flat"
                size="icon"
                aria-label={REACTION_OPTIONS[reaction].label}
                title={REACTION_OPTIONS[reaction].label}
                aria-pressed={results.data?.selected.includes(reaction) ?? false}
                disabled={mutation.isPending}
                onClick={() => react(reaction)}
              >
                <span aria-hidden className="text-lg leading-none">
                  {REACTION_OPTIONS[reaction].emoji}
                </span>
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      <span role="status" className="sr-only">
        {status}
      </span>
    </span>
  )
  const summary =
    visibleReactions.length > 0 || error ? (
      <section ref={summaryRef} aria-label="Reader reactions" className="space-y-2 print:hidden">
        {visibleReactions.length > 0 && (
          <div className="flex flex-wrap gap-2" aria-busy={mutation.isPending}>
            {visibleReactions.map((reaction) => {
              const { emoji, label } = REACTION_OPTIONS[reaction]
              const count = results.data!.counts[reaction]
              const selected = results.data!.selected.includes(reaction)
              return (
                <button
                  key={reaction}
                  type="button"
                  className={`inline-flex min-h-7 min-w-7 items-center justify-center gap-1.5 bg-transparent px-1 text-xs font-medium tracking-normal text-muted-foreground hover:text-foreground disabled:opacity-50 ${focusControlClassNames}`}
                  aria-label={`${label}: ${count} ${count === 1 ? "reaction" : "reactions"}`}
                  title={`${selected ? "Remove your" : "Add"} ${label.toLowerCase()} reaction`}
                  aria-pressed={selected}
                  disabled={mutation.isPending}
                  onClick={() => react(reaction)}
                >
                  <span aria-hidden className="text-sm leading-none">
                    {emoji}
                  </span>
                  <span aria-hidden>{count.toLocaleString("en-US")}</span>
                </button>
              )
            })}
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {results.isError && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={results.isFetching}
            onClick={() => void results.refetch()}
          >
            Try loading reactions again
          </Button>
        )}
      </section>
    ) : null
  return children({ trigger, summary })
}
