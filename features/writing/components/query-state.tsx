export function QueryState({ error, retry }: { error?: boolean; retry?: () => void }) {
  return (
    <div role={error ? "alert" : "status"} className="border-2 border-border p-6">
      <p>{error ? "Unable to load writing. Please try again." : "Loading writing…"}</p>
      {error && retry && (
        <button type="button" onClick={retry} className="mt-3 underline">
          Try again
        </button>
      )}
    </div>
  )
}
