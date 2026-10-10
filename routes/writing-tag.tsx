import { redirect, type LoaderFunctionArgs } from "react-router"

// Retain query state when migrating a legacy tag link to the unified archive.
export function loader({ request, params }: LoaderFunctionArgs) {
  const search = new URL(request.url).searchParams
  if (params.tag && !search.getAll("tag").includes(params.tag)) search.append("tag", params.tag)
  const query = search.toString()
  return redirect(`/writing${query ? `?${query}` : ""}`, 308)
}
