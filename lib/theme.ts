export type ThemePreference = "light" | "dark" | "system"

export const THEME_STORAGE_KEY = "indrax-theme"
export const THEME_CHANGE_EVENT = "indrax-theme-change"
export const DEFAULT_THEME: ThemePreference = "light"

/** Trusted inline initializer shared by SSR documents and the static admin shell. */
export const THEME_INIT_SCRIPT = `(()=>{try{const t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})||${JSON.stringify(DEFAULT_THEME)};document.documentElement.classList.toggle('dark',(t==='system'?matchMedia('(prefers-color-scheme: dark)').matches:t==='dark'));document.documentElement.dataset.theme=t}catch{}})()`

/**
 * The CSP source that lets exactly {@link THEME_INIT_SCRIPT} run inline.
 *
 * A hash, not a nonce: the static admin shell is served from assets and cannot
 * carry a per-request nonce. `lib/theme.test.ts` recomputes it, so editing the
 * script without updating this fails a test instead of silently blanking the theme.
 */
export const THEME_INIT_SCRIPT_HASH = "sha256-sC3nbee+Gna9KZMSIbwN6g9ig53eAlAkogugVYZegJI="
