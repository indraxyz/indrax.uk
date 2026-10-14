import { getRuntimeEnv } from "./runtime.server"
import { SITE_URL } from "@/config/site"
/** Read immutable deployment assets through the binding without external round trips. */
export async function assetResponse(path: string): Promise<Response> {
  const assets = getRuntimeEnv().ASSETS as Fetcher | undefined
  const request = new Request(new URL(path, SITE_URL))
  return assets ? assets.fetch(request) : fetch(request)
}
