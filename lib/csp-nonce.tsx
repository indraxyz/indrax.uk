import { createContext, useContext } from "react"

// React Router's server context supplies the nonce, but its hydrated context
// does not. Keep the document nonce available to both renders explicitly.
export const CspNonceContext = createContext<string | undefined>(undefined)

export function useCspNonce() {
  return useContext(CspNonceContext)
}
