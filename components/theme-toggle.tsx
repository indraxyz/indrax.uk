"use client"

import { Moon, Palette, Sun } from "lucide-react"
import * as React from "react"

import { Button } from "@/components/ui/button"

type ThemePreference = "light" | "dark" | "system"

const storageKey = "indrax-theme"
const themeChangeEvent = "indrax-theme-change"
const defaultTheme: ThemePreference = "light"

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
  if (typeof window === "undefined") return defaultTheme

  const storedTheme = window.localStorage.getItem(storageKey)
  return isThemePreference(storedTheme) ? storedTheme : defaultTheme
}

function subscribeToThemeStore(callback: () => void) {
  window.addEventListener("storage", callback)
  window.addEventListener(themeChangeEvent, callback)

  return () => {
    window.removeEventListener("storage", callback)
    window.removeEventListener(themeChangeEvent, callback)
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
  const [theme, setTheme] = React.useState<ThemePreference>(defaultTheme)

  React.useEffect(() => {
    const syncTheme = () => setTheme(getStoredTheme())

    syncTheme()
    return subscribeToThemeStore(syncTheme)
  }, [])

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
        window.localStorage.setItem(storageKey, nextTheme)
        setTheme(nextTheme)
        applyTheme(nextTheme)
        window.dispatchEvent(new Event(themeChangeEvent))
      }}
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
    </Button>
  )
}
