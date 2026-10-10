export function QueryState({
  error,
  retry,
  label = "writing",
}: {
  error?: boolean
  retry?: () => void
  label?: string
}) {
  return (
    <div role={error ? "alert" : "status"} className="border-2 border-border p-6">
      <p>{error ? `Unable to load ${label}. Please try again.` : `Loading ${label}…`}</p>
      {error && retry && (
        <button type="button" onClick={retry} className="mt-3 underline">
          Try again
        </button>
      )}
    </div>
  )
}
