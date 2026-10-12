import { pathToFileURL } from "node:url"

const ACCESS_TEAM = "cool-star-7099.cloudflareaccess.com"

export function isAccessRedirect(response) {
  if (response.status !== 302) return false
  try {
    const target = new URL(response.headers.get("location"))
    return (
      target.protocol === "https:" &&
      target.hostname === ACCESS_TEAM &&
      target.pathname.startsWith("/cdn-cgi/access/login/")
    )
  } catch {
    return false
  }
}

export async function verifyCloudflareSecurity(target, fetcher = fetch) {
  if (!["dev", "production"].includes(target)) throw new Error("Choose dev or production.")
  const read = (url, options = {}) =>
    fetcher(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
      ...options,
    })
  if (target === "dev") {
    for (const url of [
      "https://dev.indrax.uk/",
      "https://dev.indrax.uk/robots.txt",
      "https://dev.indrax.uk/api/admin/session",
      "https://dev.indrax.uk/api/upload",
      "https://dev.indrax.uk/admin/assets/security-smoke.js",
      "https://dev-media.indrax.uk/covers/security-smoke.png",
    ]) {
      const response = await read(url, { method: "HEAD" })
      if (!isAccessRedirect(response))
        throw new Error(`Access is not denying ${url}: ${response.status}`)
    }
  } else {
    const page = await read("https://indrax.uk/", { method: "HEAD" })
    const policy = page.headers.get("content-security-policy") ?? ""
    const scripts = policy.split(";").find((part) => part.trim().startsWith("script-src "))
    if (
      page.status !== 200 ||
      !scripts ||
      scripts.includes("'unsafe-inline'") ||
      scripts.includes("'unsafe-eval'")
    )
      throw new Error(
        "Production is not serving the expected public page with strict script policy."
      )
    const upload = await read("https://indrax.uk/api/upload?purpose=cover", {
      method: "POST",
      headers: { origin: "https://indrax.uk", "content-type": "image/png" },
      body: "",
    })
    if (upload.status !== 401 || !upload.headers.get("content-type")?.includes("application/json"))
      throw new Error("Production is not refusing signed-out uploads.")
    const media = await read("https://media.indrax.uk/covers/security-smoke.png", {
      method: "HEAD",
    })
    if (media.headers.get("x-content-type-options") !== "nosniff")
      throw new Error("Production media is missing nosniff protection.")
  }
  console.log(`Verified ${target} Cloudflare security boundaries.`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await verifyCloudflareSecurity(process.argv[2])
