import { readFileSync } from "node:fs"

import { expect, test, type Locator, type Page } from "@playwright/test"

import {
  fieldClassNames,
  loadingIndicatorClassNames,
  loadingIndicatorSizes,
} from "@/components/ui/variants"
import { badgeVariants } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { THEME_STORAGE_KEY } from "@/lib/theme"
import { whenHydrated } from "./support/hydration"
import { contrastRatio } from "./support/visual-controls"

const variants = ["primary", "secondary", "tertiary", "destructive", "ghost"] as const

// Exercise the shared class recipes against both independent application CSS
// bundles. Actual UI interactions are covered by navigation and archive tests.
const spinnerSvg = readFileSync(
  new URL("../components/ui/loading-spinner.svg", import.meta.url),
  "utf8"
)

const loadingFixture = (size: keyof typeof loadingIndicatorSizes = "sm") =>
  `<span aria-hidden="true" data-slot="loading-indicator" class="${loadingIndicatorClassNames} ${loadingIndicatorSizes[size].container}">${spinnerSvg}</span>`

const fixture = (appearance: "raised" | "flat") => `
  <div id="visual-variants" class="space-y-4 bg-background p-6 text-foreground">
    ${variants
      .map(
        (variant) => `
      <div class="flex flex-wrap items-center gap-4">
        <button id="button-${variant}" class="${cn(buttonVariants({ variant, appearance }))}">${variant}${loadingFixture()}</button>
        <button id="raw-${variant}" class="${buttonVariants({ variant, appearance })}">Raw ${variant}</button>
        <div id="badge-${variant}" class="${cn(badgeVariants({ variant }))}">${variant}</div>
      </div>
    `
      )
      .join("")}
    <input id="shared-field" aria-label="Shared field" class="${fieldClassNames}" />
    <div id="standalone-loading">${loadingFixture("lg")}</div>
    <div id="hover-card" class="rounded-none border-2 border-border bg-card text-card-foreground shadow-soft p-6 transition-shadow hover:shadow-soft-lg">Hover card</div>
    <div id="flat-card" class="rounded-none border-2 border-border bg-card text-card-foreground p-6 shadow-none">Flat card</div>
  </div>
`

async function styles(locator: Locator) {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      color: style.color,
      background: style.backgroundColor,
      shadow: style.boxShadow,
      translate: style.translate,
      transform: style.transform,
    }
  })
}

async function expectedForeground(locator: Locator) {
  return locator.evaluate((element) => {
    const probe = document.createElement("span")
    probe.style.color = "var(--variant-fg)"
    element.appendChild(probe)
    const color = getComputedStyle(probe).color
    probe.remove()
    return color
  })
}

async function moveOffControls(page: Page) {
  await page.mouse.move(0, 0)
}

async function hasVisibleShadow(locator: Locator) {
  return locator.evaluate((element) => {
    // Tailwind composes shadows and rings with transparent zero-size shadows;
    // those serialize differently across engines but have no visible elevation.
    const shadow = getComputedStyle(element).boxShadow
    if (shadow === "none") return false
    const lengths = shadow.replace(/(?:rgba?|oklab|oklch|color)\([^)]*\)/g, "").match(/-?[\d.]+px/g)
    return Boolean(lengths?.some((length) => Number.parseFloat(length) !== 0))
  })
}

async function expectFlat(control: Locator) {
  await expect.poll(() => hasVisibleShadow(control)).toBe(false)
  await expect
    .poll(async () => {
      const current = await styles(control)
      return ["none", "0px", "0px 0px"].includes(current.translate) && current.transform === "none"
    })
    .toBe(true)
}

for (const appearance of ["raised", "flat"] as const) {
  for (const route of ["/resume", "/admin/login"]) {
    for (const theme of ["light", "dark"] as const) {
      test(`${route} ${appearance} shared visual variants remain readable and reset interaction styles in ${theme}`, async ({
        page,
      }) => {
        await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
          key: THEME_STORAGE_KEY,
          value: theme,
        })
        await page.goto(route)
        // Wait for each application's startup before changing its theme for the fixture.
        await expect(page.getByRole("main")).toBeVisible()
        if (route === "/resume") await whenHydrated(page)
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme)
        await page.evaluate((markup) => {
          const fixtureRoot = document.createElement("div")
          fixtureRoot.innerHTML = markup
          document.body.insertBefore(fixtureRoot, document.body.firstChild)
        }, fixture(appearance))
        // Font swapping changes text widths independently of pointer interactions.
        await page.evaluate(() => document.fonts.ready)
        await moveOffControls(page)

        for (const variant of variants) {
          const button = page.locator(`#button-${variant}`)
          const raw = page.locator(`#raw-${variant}`)
          const badge = page.locator(`#badge-${variant}`)
          const foreground = await expectedForeground(button)

          const loading = button.locator('[data-slot="loading-indicator"]')
          await expect(loading).toHaveCSS("color", foreground)
          await expect(loading).toHaveCSS("width", "20px")
          await expect(loading).toHaveCSS("height", "20px")
          await expect(loading).toHaveCSS("background-color", "rgba(0, 0, 0, 0)")
          await expect(loading.locator("svg")).toHaveCSS("width", "20px")
          await expect(loading.locator("svg")).toHaveCSS("height", "20px")
          await expect(loading.locator("svg")).toHaveCSS("fill", "none")
          await expect(loading.locator("circle")).toHaveCSS("stroke", foreground)
          await expect(loading.locator("circle")).toHaveCSS("stroke-opacity", "0.18")
          await expect(loading.locator("path")).toHaveCSS("stroke", foreground)
          await expect(loading).toHaveCSS("animation-name", "spin")
          if (variant !== "ghost") {
            const subtleBorder =
              (theme === "light" && variant === "tertiary") ||
              (theme === "dark" && (variant === "primary" || variant === "secondary"))
            const border = await badge.evaluate((element, subtle) => {
              const probe = document.createElement("span")
              probe.style.color = subtle
                ? "color-mix(in oklab, var(--variant-border) 30%, transparent)"
                : "var(--semantic-border-strong)"
              element.appendChild(probe)
              const result = getComputedStyle(probe).color
              probe.remove()
              return result
            }, subtleBorder)
            await expect(badge).toHaveCSS("border-top-color", border)
          }

          // Raw buttonVariants consumers (dialogs and sign-out) must look like Button.
          await expect(button).toHaveCSS("color", foreground)
          await expect(raw).toHaveCSS("color", foreground)
          await expect(badge).toHaveCSS("color", await expectedForeground(badge))
          for (const control of [button, raw, badge]) {
            expect(await contrastRatio(control)).toBeGreaterThanOrEqual(4.5)
          }

          if (appearance === "flat") {
            for (const control of [button, raw]) {
              await expectFlat(control)
              await control.hover()
              await expectFlat(control)
              await page.mouse.down()
              try {
                await expectFlat(control)
              } finally {
                await page.mouse.up()
              }
              await control.evaluate((element: HTMLButtonElement) => element.blur())
              await moveOffControls(page)
              await page.keyboard.press("Tab")
              await control.focus()
              await expect
                .poll(() => control.evaluate((element) => element.matches(":focus-visible")))
                .toBe(true)
              expect(await hasVisibleShadow(control)).toBe(true)
              await control.evaluate((element: HTMLButtonElement) => element.blur())
            }
          }
          const resting = await styles(button)
          const restingBounds = await button.boundingBox()
          await button.hover()
          await expect
            .poll(async () => (await styles(button)).background)
            .not.toBe(resting.background)
          await button.evaluate(async (element) => {
            await Promise.all(element.getAnimations().map((animation) => animation.finished))
          })
          expect(await button.boundingBox()).toEqual(restingBounds)
          await page.mouse.down()
          try {
            expect(await button.boundingBox()).toEqual(restingBounds)
          } finally {
            await page.mouse.up()
          }
          expect(await contrastRatio(button)).toBeGreaterThanOrEqual(4.5)
          await moveOffControls(page)
          await expect.poll(() => styles(button)).toEqual(resting)

          // Keyboard focus adds its ring without replacing the raised button shadow.
          await page.keyboard.press("Tab")
          await button.focus()
          await expect(button).toBeFocused()
          await expect(button).toHaveJSProperty("disabled", false)
          await expect
            .poll(() => button.evaluate((element) => element.matches(":focus-visible")))
            .toBe(true)
          const focusedShadow = (await styles(button)).shadow
          expect(focusedShadow).not.toBe(resting.shadow)
          if (appearance === "raised" && variant !== "ghost")
            expect(focusedShadow).toContain("3px 3px")
          await button.evaluate((element: HTMLButtonElement) => element.blur())

          // A disabled raised button must lose its elevation and movement.
          await button.evaluate((element: HTMLButtonElement) => {
            element.disabled = true
          })
          await expect(button).toBeDisabled()
          await expect.poll(() => hasVisibleShadow(button)).toBe(false)
          await expect
            .poll(async () => {
              const current = await styles(button)
              return ["none", "0px", "0px 0px"].includes(current.translate)
            })
            .toBe(true)
          await button.evaluate((element: HTMLButtonElement) => {
            element.disabled = false
          })
          await expect.poll(() => styles(button)).toEqual(resting)
          if (variant === "ghost") expect(await hasVisibleShadow(button)).toBe(false)
        }

        const field = page.locator("#shared-field")
        await field.focus()
        await expect(field).toHaveCSS("--tw-ring-offset-width", "0px")
        await expect(page.locator('#standalone-loading [data-slot="loading-indicator"]')).toHaveCSS(
          "width",
          "48px"
        )

        const standaloneLoading = page.locator(
          '#standalone-loading [data-slot="loading-indicator"]'
        )
        await expect(standaloneLoading.locator("svg")).toHaveCSS("width", "48px")
        await page.emulateMedia({ reducedMotion: "reduce" })
        await expect(standaloneLoading).toHaveCSS("animation-name", "none")
        await page.emulateMedia({ reducedMotion: "no-preference" })

        const card = page.locator("#hover-card")
        const cardResting = (await styles(card)).shadow
        expect(cardResting).toContain("6px 6px")
        await card.hover()
        await expect.poll(async () => (await styles(card)).shadow).toContain("10px 10px")
        await moveOffControls(page)
        await expect.poll(async () => (await styles(card)).shadow).toBe(cardResting)
        expect(await hasVisibleShadow(page.locator("#flat-card"))).toBe(false)
      })
    }
  }
}
