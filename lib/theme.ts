export type ThemePreference = "light" | "dark" | "system"

export const THEME_STORAGE_KEY = "indrax-theme"
export const THEME_CHANGE_EVENT = "indrax-theme-change"
export const DEFAULT_THEME: ThemePreference = "light"

/** Trusted inline initializer shared by SSR documents and the static admin shell. */
export const THEME_INIT_SCRIPT = `(()=>{try{const t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})||${JSON.stringify(DEFAULT_THEME)};document.documentElement.classList.toggle('dark',(t==='system'?matchMedia('(prefers-color-scheme: dark)').matches:t==='dark'));document.documentElement.dataset.theme=t}catch{}})()`
