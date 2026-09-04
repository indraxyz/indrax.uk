export const E2E_PORT = Number(process.env.E2E_PORT ?? 3210)
export const E2E_BASE_URL = `http://127.0.0.1:${E2E_PORT}`

// A throwaway key, so the build under test takes the analytics path at all -
// `NEXT_PUBLIC_*` values are inlined at build time, not read at runtime.
export const E2E_POSTHOG_KEY = "phc_e2e_dummy_key"

// Deliberately non-routable. The specs intercept these requests in the page, so
// nothing reaches a real project; if an interception is ever missed the request
// fails fast instead of quietly posting test traffic somewhere real.
export const E2E_POSTHOG_HOST = "https://posthog.e2e.invalid"
