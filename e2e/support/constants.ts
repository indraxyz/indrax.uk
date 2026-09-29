export const E2E_PORT = Number(process.env.E2E_PORT ?? 3210)
export const E2E_BASE_URL = `http://127.0.0.1:${E2E_PORT}`

// A throwaway key, so the build under test takes the analytics path at all -
// `NEXT_PUBLIC_*` values are inlined at build time, not read at runtime.
export const E2E_POSTHOG_KEY = "phc_e2e_dummy_key"

// Deliberately non-routable. The specs intercept these requests in the page, so
// nothing reaches a real project; if an interception is ever missed the request
// fails fast instead of quietly posting test traffic somewhere real.
export const E2E_POSTHOG_HOST = "https://posthog.e2e.invalid"

// The seeded fixtures from `lib/db/seed.ts`. Named here so a spec asserting on
// them reads as a reference to the fixture rather than a magic string, and so
// renaming one is a single edit.
export const SEEDED_POST_SLUG = "rendering-an-article-without-shipping-a-renderer"
export const SEEDED_SECOND_POST_SLUG = "a-database-that-is-allowed-to-be-absent"
export const SEEDED_DRAFT_SLUG = "notes-on-preview-tokens"
export const SEEDED_DRAFT_TITLE = "Notes on preview tokens"
export const SEEDED_TAG_SLUG = "typescript"

// The series the seeded posts belong to. Two published parts and one draft, which
// is what makes "part 1 of 2" rather than "part 1 of 3" a meaningful assertion.
export const SEEDED_SERIES_SLUG = "building-this-blog"
export const SEEDED_SERIES_TITLE = "Building this blog"
export const SEEDED_PUBLISHED_PARTS = 2
