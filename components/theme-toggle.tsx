"use client"

import { Moon, Palette, Sun } from "lucide-react"
import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  DEFAULT_THEME,
  THEME_CHANGE_EVENT,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from "@/lib/theme"

function getSystemTheme() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

function applyTheme(theme: ThemePreference) {
  const resolvedTheme = theme === "system" ? getSystemTheme() : theme

  document.documentElement.classList.toggle("dark", resolvedTheme === "dark")
  document.documentElement.dataset.theme = theme
}

function getNextTheme(theme: ThemePreference): ThemePreference {
  if (theme === "light") return "dark"
  if (theme === "dark") return "system"
  return "light"
}

function isThemePreference(theme: string | null): theme is ThemePreference {
  return theme === "light" || theme === "dark" || theme === "system"
}

function getStoredTheme(): ThemePreference {
  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
  return isThemePreference(storedTheme) ? storedTheme : DEFAULT_THEME
}

// The server has no stored preference to read, so it renders the default and the
// inline head script has already applied the real one to <html> by then.
function getServerTheme(): ThemePreference {
  return DEFAULT_THEME
}

function subscribeToThemeStore(callback: () => void) {
  window.addEventListener("storage", callback)
  window.addEventListener(THEME_CHANGE_EVENT, callback)

  return () => {
    window.removeEventListener("storage", callback)
    window.removeEventListener(THEME_CHANGE_EVENT, callback)
  }
}

const themeLabels = {
  light: "Switch theme: light",
  dark: "Switch theme: dark",
  system: "Switch theme: system",
} satisfies Record<ThemePreference, string>

const themeIcons = {
  light: Sun,
  dark: Moon,
  system: Palette,
} satisfies Record<ThemePreference, typeof Sun>

export function ThemeToggle() {
  // Reading the store directly rather than syncing it into state in an effect
  // keeps the very first client render on the stored preference, so the icon no
  // longer shows the default for a frame before correcting itself.
  const theme = React.useSyncExternalStore(subscribeToThemeStore, getStoredTheme, getServerTheme)

  // Keeps <html> in step with the store, including a preference changed in
  // another tab, which arrives here as a storage event and no other way.
  React.useEffect(() => {
    applyTheme(theme)
  }, [theme])

  React.useEffect(() => {
    if (theme !== "system") return

    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const handleChange = () => applyTheme("system")

    media.addEventListener("change", handleChange)
    return () => media.removeEventListener("change", handleChange)
  }, [theme])

  const Icon = themeIcons[theme]
  const nextTheme = getNextTheme(theme)

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={`${themeLabels[theme]}. Activate ${nextTheme} mode.`}
      title={`${themeLabels[theme]} -> ${nextTheme}`}
      onClick={() => {
        window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme)
        // Storage events only reach other tabs, so this is what tells the
        // subscribers in this one to re-read the store.
        window.dispatchEvent(new Event(THEME_CHANGE_EVENT))
      }}
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
    </Button>
  )
}
