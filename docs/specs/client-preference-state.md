# Client preference state

Consent is read from validated persistent storage and fails closed on storage errors.
Banner, footer control and analytics share one subscription for same-document events,
relevant cross-document key changes, removals and storage clears. Unrelated keys do
not notify. Unsubscribing removes both listeners. Failed consent mutations suppress
any stale persisted grant for this document; failed grants never enable tracking.

Theme and admin cards/table choices use validated raw strings under existing keys.
Failed writes retain the explicit choice in document memory ahead of stale storage.
Relevant cross-document changes discard that fallback and reread persistence.
Server reads return existing defaults. Theme system-mode media observation and the
inline initializer/CSP hash remain unchanged. Archive query state is unaffected.

Regression coverage includes storage exceptions, stale values, event filtering,
unsubscription, second-tab consent changes, and theme persistence and system mode.
