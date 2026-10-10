import { redirect, type LoaderFunctionArgs } from "react-router"

// Keep existing bookmarks working; discovery has one public archive URL.
export function loader({ request }: LoaderFunctionArgs) {
  const params = new URL(request.url).searchParams
  const search = params.toString()
  return redirect(`/writing${search ? `?${search}` : ""}`, 308)
}
