import { createRoot } from "react-dom/client"
import { RouterProvider } from "react-router/dom"
import { QueryProvider } from "@/components/query-provider"
import { router } from "./routes"
import { ImageLoadingEffects } from "@/components/image-loading-effects"
import "@/app/globals.css"
createRoot(document.getElementById("root")!).render(
  <QueryProvider>
    <ImageLoadingEffects />
    <RouterProvider router={router} />
  </QueryProvider>
)
