import { data } from "react-router"
import { SiteErrorPage } from "@/components/site-error-page"

export function loader() {
  throw data("Not found", { status: 404 })
}
export const meta = () => [{ title: "Not found" }, { name: "robots", content: "noindex, nofollow" }]
export default function NotFound() {
  return <SiteErrorPage />
}
