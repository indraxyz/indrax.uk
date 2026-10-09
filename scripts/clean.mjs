import { rm } from "node:fs/promises"
await Promise.all(
  ["build", ".react-router", "public/admin", ".next", ".open-next"].map((path) =>
    rm(path, { recursive: true, force: true })
  )
)
