import { renderToReadableStream } from "react-dom/server"
import { ServerRouter, type EntryContext } from "react-router"
import { logServerError } from "@/lib/observability"
import { contentSecurityPolicy, createCspNonce } from "@/lib/security-headers"
export default async function handleRequest(
  request: Request,
  status: number,
  headers: Headers,
  context: EntryContext
) {
  // One nonce per document. React Router stamps it on every inline script it
  // renders, and the policy below admits only those (threat T-12).
  const nonce = createCspNonce()
  const stream = await renderToReadableStream(
    <ServerRouter context={context} url={request.url} nonce={nonce} />,
    {
      nonce,
      signal: request.signal,
      onError(error) {
        logServerError(error, { scope: "ssr.render", path: new URL(request.url).pathname })
      },
    }
  )
  await stream.allReady
  headers.set("Content-Type", "text/html; charset=utf-8")
  headers.set(
    "Content-Security-Policy",
    contentSecurityPolicy({ nonce, strictScripts: import.meta.env.PROD })
  )
  return new Response(stream, { status, headers })
}
