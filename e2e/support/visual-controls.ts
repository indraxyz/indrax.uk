import { expect, type Locator, type Page } from "@playwright/test"

/** Resolve CSS color formats and transparency against the page before measuring contrast. */
export async function contrastRatio(control: Locator): Promise<number> {
  return control.evaluate((element) => {
    const canvas = document.createElement("canvas")
    canvas.width = canvas.height = 1
    const context = canvas.getContext("2d")!
    const style = getComputedStyle(element)
    context.fillStyle = getComputedStyle(document.body).backgroundColor
    context.fillRect(0, 0, 1, 1)
    context.fillStyle = style.backgroundColor
    context.fillRect(0, 0, 1, 1)
    const background = context.getImageData(0, 0, 1, 1).data.slice(0, 3)
    context.fillStyle = style.color
    context.fillRect(0, 0, 1, 1)
    const foreground = context.getImageData(0, 0, 1, 1).data.slice(0, 3)
    const luminance = (rgb: Uint8ClampedArray) =>
      [...rgb].reduce((sum, channel, index) => {
        const value = channel / 255
        const linear = value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
        return sum + linear * [0.2126, 0.7152, 0.0722][index]
      }, 0)
    const first = luminance(foreground)
    const second = luminance(background)
    return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)
  })
}

/** Hover must preserve readable text, then leave the original background when the pointer moves. */
export async function expectReadableAction(page: Page, control: Locator) {
  await page.mouse.move(0, 0)
  await control.evaluate(async (element) => {
    await Promise.all(element.getAnimations().map((animation) => animation.finished))
  })
  const background = await control.evaluate((element) => getComputedStyle(element).backgroundColor)
  // These flat actions retain focus rings but have no decorative shadow or motion.
  const resting = await control.evaluate((element) => {
    const style = getComputedStyle(element)
    return { shadow: style.boxShadow, translate: style.translate }
  })
  expect(await contrastRatio(control)).toBeGreaterThanOrEqual(4.5)
  await control.hover()
  await control.evaluate(async (element) => {
    await Promise.all(element.getAnimations().map((animation) => animation.finished))
  })
  expect(await contrastRatio(control)).toBeGreaterThanOrEqual(4.5)
  await expect(control).toHaveCSS("box-shadow", resting.shadow)
  await expect(control).toHaveCSS("translate", resting.translate)
  await page.mouse.move(0, 0)
  await expect(control).toHaveCSS("background-color", background)
}
