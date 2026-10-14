import { handleAnalyticsGateway } from "../../lib/analytics-gateway.server"
import { getRuntimeEnv, runWithRequest } from "../../lib/runtime.server"

// Mock only the upstream transport. Constructing the outgoing Request inside
// Workerd exercises its actual fetch options, including supported redirect modes.
globalThis.fetch = async (input, init) => {
  const outgoing = new Request(input, init)
  if (outgoing.redirect !== "manual") throw new Error("Upstream redirects must be refused.")
  const url = new URL(outgoing.url)
  const projectToken = String(getRuntimeEnv().POSTHOG_PROJECT_TOKEN)
  const redirect = Number(url.searchParams.get("v"))
  if ([301, 302, 303, 307, 308].includes(redirect))
    return new Response(null, {
      status: redirect,
      headers: { Location: "https://untrusted.example/collect" },
    })
  if (url.pathname === `/array/${projectToken}/config`)
    return Response.json({ token: projectToken, sessionRecording: { enabled: true } })
  if (
    /^\/static\/(?:\d+\.\d+\.\d+\/)?(?:recorder|web-vitals|web-vitals-with-attribution|dead-clicks-autocapture)\.js$/.test(
      url.pathname
    )
  )
    return new Response("/* fixture recorder */", {
      headers: { "Content-Type": "text/javascript" },
    })
  const payload = (await outgoing.json()) as {
    token?: string
    api_key?: string
    batch?: { properties: { token: string } }[]
  }
  const token = payload.token ?? payload.api_key
  if (token !== projectToken) return new Response(null, { status: 401 })
  if (payload.batch?.some((event) => event.properties.token !== token))
    return new Response(null, { status: 401 })
  return Response.json({ status: 1, featureFlags: {} })
}

export default {
  fetch(request: Request, env: Record<string, unknown>, ctx: ExecutionContext) {
    return runWithRequest(request, env, ctx, () => handleAnalyticsGateway(request))
  },
} satisfies ExportedHandler<Record<string, unknown>>
