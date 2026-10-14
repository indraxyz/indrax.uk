import { pathToFileURL } from "node:url"
import { createRequire } from "node:module"

const sdkVersion = createRequire(import.meta.url)("posthog-js/package.json").version

// Exercise the deployed Worker and real upstream without creating synthetic events.
export async function verifyAnalytics(target, fetcher = fetch) {
  if (!["dev", "production"].includes(target)) throw new Error("Choose dev or production.")
  const origin = target === "dev" ? "https://dev.indrax.uk" : "https://indrax.uk"
  for (const suffix of ["", ".js"]) {
    const response = await fetcher(
      `${origin}/api/analytics/array/phc_indrax_gateway/config${suffix}`,
      {
        headers: { Referer: `${origin}/` },
        redirect: "manual",
        credentials: "omit",
        signal: AbortSignal.timeout(15_000),
      }
    )
    const type = response.headers.get("content-type") ?? ""
    const expectedType = suffix ? "text/javascript" : "application/json"
    if (response.status !== 200 || !type.startsWith(expectedType)) {
      await response.body?.cancel()
      throw new Error(`${target} analytics config${suffix} failed: HTTP ${response.status}.`)
    }
    const text = await response.text()
    if (suffix) {
      if (!text.includes("window._POSTHOG_REMOTE_CONFIG") || !text.includes("phc_indrax_gateway"))
        throw new Error(`${target} analytics script is missing SDK configuration.`)
    } else {
      const config = JSON.parse(text)
      if (!config || typeof config !== "object" || Array.isArray(config))
        throw new Error(`${target} analytics configuration must be an object.`)
    }
  }
  for (const asset of ["web-vitals", "web-vitals-with-attribution", "dead-clicks-autocapture"]) {
    const response = await fetcher(`${origin}/api/analytics/static/${sdkVersion}/${asset}.js`, {
      headers: { Referer: `${origin}/` },
      redirect: "manual",
      credentials: "omit",
      signal: AbortSignal.timeout(15_000),
    })
    await response.body?.cancel()
    if (
      response.status !== 200 ||
      !response.headers.get("content-type")?.startsWith("text/javascript")
    )
      throw new Error(`${target} analytics ${asset}.js failed: HTTP ${response.status}.`)
  }
  console.log(
    `Verified ${target} analytics configuration and SDK assets through the deployed gateway.`
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await verifyAnalytics(process.argv[2])
