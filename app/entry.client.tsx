import { startTransition } from "react"
import { hydrateRoot } from "react-dom/client"
import { HydratedRouter } from "react-router/dom"
import { CspNonceContext } from "@/lib/csp-nonce"

// Browsers hide nonce attribute values; the DOM property retains the value.
const nonce = document.querySelector<HTMLScriptElement>("script[nonce]")?.nonce
startTransition(() => {
  hydrateRoot(
    document,
    <CspNonceContext.Provider value={nonce}>
      <HydratedRouter />
    </CspNonceContext.Provider>
  )
})
