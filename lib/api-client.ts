import ky, { HTTPError } from "ky"

/** Same-origin API transport. Mutations are never retried automatically. */
export const api = ky.create({ credentials: "same-origin", retry: 0, timeout: 30_000 })

export function apiErrorMessage(error: unknown) {
  if (
    error instanceof HTTPError &&
    [401, 403].includes(error.response.status) &&
    typeof window !== "undefined"
  ) {
    window.dispatchEvent(new Event("admin-session-expired"))
  }
  return error instanceof Error
    ? "The request could not be completed. Please try again."
    : "Something went wrong."
}
