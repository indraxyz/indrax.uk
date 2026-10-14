import { pathToFileURL } from "node:url"
import { createRequire } from "node:module"

const sdkVersion = createRequire(import.meta.url)("posthog-js/package.json").version

const transportCodes = new Set([
  "ETIMEDOUT",
  "ECONNRESET",
  "EAI_AGAIN",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT",
  "UND_ERR_SOCKET",
])

async function readAnalytics(url, fetcher, verify) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const signal = AbortSignal.timeout(15_000)
    try {
      const response = await fetcher(url, {
        headers: { Referer: `${new URL(url).origin}/` },
        redirect: "manual",
        credentials: "omit",
        signal,
      })
      try {
        await verify(response)
      } finally {
        // Cleanup must not replace an HTTP/MIME validation failure with a retryable error.
        if (!response.bodyUsed) await response.body?.cancel().catch(() => {})
      }
      return
    } catch (error) {
      const timedOut =
        error?.name === "TimeoutError" ||
        (error?.name === "AbortError" && signal.reason?.name === "TimeoutError")
      const code = error?.cause?.code ?? error?.code
      const retryable = timedOut || transportCodes.has(code)
      const reason = timedOut
        ? "request timed out after 15000ms"
        : (code ?? error?.message ?? String(error))
      if (!retryable || attempt === 3)
        throw new Error(`Analytics smoke ${url} failed on attempt ${attempt}: ${reason}`)
      console.warn(`Analytics smoke ${url}: ${reason}; retrying (${attempt}/3).`)
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000))
    }
  }
}

// Exercise the deployed Worker and real upstream without creating synthetic events.
export async function verifyAnalytics(target, fetcher = fetch) {
  if (!["dev", "production"].includes(target)) throw new Error("Choose dev or production.")
  const origin = target === "dev" ? "https://dev.indrax.uk" : "https://indrax.uk"
  for (const suffix of ["", ".js"]) {
    await readAnalytics(
      `${origin}/api/analytics/array/phc_indrax_gateway/config${suffix}`,
      fetcher,
      async (response) => {
        const type = response.headers.get("content-type") ?? ""
        const expectedType = suffix ? "text/javascript" : "application/json"
        if (response.status !== 200 || !type.startsWith(expectedType))
          throw new Error(`${target} analytics config${suffix} failed: HTTP ${response.status}.`)
        const text = await response.text()
        if (suffix) {
          if (
            !text.includes("window._POSTHOG_REMOTE_CONFIG") ||
            !text.includes("phc_indrax_gateway")
          )
            throw new Error(`${target} analytics script is missing SDK configuration.`)
        } else {
          const config = JSON.parse(text)
          if (!config || typeof config !== "object" || Array.isArray(config))
            throw new Error(`${target} analytics configuration must be an object.`)
        }
      }
    )
  }
  for (const asset of ["web-vitals", "web-vitals-with-attribution", "dead-clicks-autocapture"]) {
    await readAnalytics(
      `${origin}/api/analytics/static/${sdkVersion}/${asset}.js`,
      fetcher,
      async (response) => {
        if (
          response.status !== 200 ||
          !response.headers.get("content-type")?.startsWith("text/javascript")
        )
          throw new Error(`${target} analytics ${asset}.js failed: HTTP ${response.status}.`)
      }
    )
  }
  console.log(
    `Verified ${target} analytics configuration and SDK assets through the deployed gateway.`
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await verifyAnalytics(process.argv[2])
