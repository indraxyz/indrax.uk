import { pathToFileURL } from "node:url"

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
  console.log(`Verified ${target} analytics configuration through the deployed gateway.`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await verifyAnalytics(process.argv[2])
