import { renderToReadableStream } from "react-dom/server"
import { ServerRouter, type EntryContext } from "react-router"
import { logServerError } from "@/lib/observability"
export default async function handleRequest(
  request: Request,
  status: number,
  headers: Headers,
  context: EntryContext
) {
  const stream = await renderToReadableStream(
    <ServerRouter context={context} url={request.url} />,
    {
      signal: request.signal,
      onError(error) {
        logServerError(error, { scope: "ssr.render", path: new URL(request.url).pathname })
      },
    }
  )
  await stream.allReady
  headers.set("Content-Type", "text/html; charset=utf-8")
  return new Response(stream, { status, headers })
}
