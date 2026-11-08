import { useEffect, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
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

/** Additive to article SSR: counts load once and writes never rerender its content. */
export function PostReactions({ slug }: { slug: string }) {
  const client = useQueryClient()
  const [visitorId, setVisitorId] = useState<string | null | undefined>(undefined)
  const [message, setMessage] = useState("")
  const submitting = useRef(false)
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
      setMessage("Allow site storage to save your reaction, then try again.")
    }
  }

  return (
    <section
      aria-label="Reader reactions"
      className="mt-6 border-2 border-border bg-card p-4 sm:p-6 print:hidden"
    >
      <h2 className="text-sm font-black uppercase tracking-[0.14em]">React to this writing</h2>
      <div
        className="mt-3 grid max-w-md grid-cols-5 gap-2"
        aria-busy={mutation.isPending || results.isFetching}
      >
        {REACTIONS.map((reaction) => {
          const { emoji, label } = REACTION_OPTIONS[reaction]
          const count = results.data?.counts[reaction]
          const selected = results.data?.selected.includes(reaction) ?? false
          return (
            <Button
              key={reaction}
              type="button"
              variant={selected ? "secondary" : "ghost"}
              appearance="flat"
              className="min-w-0 px-1 sm:px-3"
              aria-label={`${label}: ${count === undefined ? "count unavailable" : `${count} reactions`}`}
              aria-pressed={selected}
              disabled={!results.data || mutation.isPending}
              onClick={() => react(reaction)}
            >
              <span aria-hidden="true" className="text-lg">
                {emoji}
              </span>
              <span aria-hidden="true">
                {count === undefined ? "—" : count.toLocaleString("en-US")}
              </span>
            </Button>
          )
        })}
      </div>
      <p role="status" className="mt-3 text-sm text-muted-foreground">
        {message ||
          (results.isError
            ? "Reactions could not be loaded."
            : !results.data
              ? "Loading reactions…"
              : "Choose any reaction. Select it again to remove it.")}
      </p>
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
  )
}
