import { pathToFileURL } from "node:url"

export async function verifyCloudflareSecurity(target, fetcher = fetch) {
  if (!["dev", "production"].includes(target)) throw new Error("Choose dev or production.")
  const origin = target === "dev" ? "https://dev.indrax.uk" : "https://indrax.uk"
  const mediaOrigin = target === "dev" ? "https://dev-media.indrax.uk" : "https://media.indrax.uk"
  const read = (url, options = {}) =>
    fetcher(url, {
      redirect: "manual",
      credentials: "omit",
      signal: AbortSignal.timeout(15_000),
      ...options,
    })

  for (const path of ["/", "/admin/login"]) {
    const page = await read(`${origin}${path}`)
    const policy = page.headers.get("content-security-policy") ?? ""
    const scripts = policy.split(";").find((part) => part.trim().startsWith("script-src "))
    if (
      page.status !== 200 ||
      !scripts ||
      scripts.includes("'unsafe-inline'") ||
      scripts.includes("'unsafe-eval'")
    )
      throw new Error(`${target} ${path} is not publicly reachable with a strict script policy.`)
    if (
      (target === "dev" || path === "/admin/login") &&
      !page.headers.get("x-robots-tag")?.includes("noindex")
    )
      throw new Error(`${target} ${path} must remain noindex.`)
    await page.body?.cancel()
  }

  if (target === "dev") {
    const robots = await read(`${origin}/robots.txt`)
    if (robots.status !== 200 || !/^Disallow:\s*\/\s*$/m.test(await robots.text()))
      throw new Error("Dev robots.txt must disallow indexing.")
  }

  const admin = await read(`${origin}/admin`)
  const location = admin.headers.get("location")
  if (
    admin.status !== 302 ||
    !location ||
    new URL(location, origin).href !== `${origin}/admin/login`
  )
    throw new Error(`${target} must redirect signed-out admin visitors to the app login.`)
  await admin.body?.cancel()

  const session = await read(`${origin}/api/admin/session`)
  if (
    session.status !== 200 ||
    !session.headers.get("content-type")?.includes("application/json") ||
    !session.headers.get("cache-control")?.includes("no-store")
  )
    throw new Error(`${target} anonymous session must be uncached JSON.`)
  const info = await session.json()
  if (
    info?.author !== null ||
    info.authConfigured !== true ||
    Object.keys(info).sort().join(",") !== "authConfigured,author"
  )
    throw new Error(`${target} must expose configured GitHub sign-in without private session data.`)

  for (const path of ["/api/admin/posts/archive", "/api/admin/tags", "/api/admin/overview"]) {
    const response = await read(`${origin}${path}`)
    if (
      response.status !== 401 ||
      !response.headers.get("content-type")?.includes("application/json") ||
      !response.headers.get("cache-control")?.includes("no-store")
    )
      throw new Error(`${target} ${path} must refuse signed-out reads with uncached JSON.`)
    await response.body?.cancel()
  }

  const upload = await read(`${origin}/api/upload?purpose=cover`, {
    method: "POST",
    headers: { origin, "content-type": "image/png" },
    body: "",
  })
  if (upload.status !== 401 || !upload.headers.get("content-type")?.includes("application/json"))
    throw new Error(`${target} is not refusing signed-out uploads.`)
  await upload.body?.cancel()

  const media = await read(`${mediaOrigin}/covers/security-smoke.png`)
  if (
    media.status !== 404 ||
    media.headers.get("x-content-type-options") !== "nosniff" ||
    !media.headers
      .get("content-security-policy")
      ?.split(";")
      .some((part) => part.trim() === "sandbox")
  )
    throw new Error(`${target} missing cover media must return a public 404 with safety headers.`)
  await media.body?.cancel()
  console.log(`Verified ${target} public access and GitHub-authenticated admin boundaries.`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await verifyCloudflareSecurity(process.argv[2])
