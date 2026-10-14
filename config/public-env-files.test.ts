import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { publicEnvDefinitions } from "./public-env"

let directory: string
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "indrax-public-env-"))
  vi.spyOn(process, "cwd").mockReturnValue(directory)
  for (const name of ["SITE_URL", "MEDIA_ORIGIN", "SITE_UPDATED_AT", "ANALYTICS_ENABLED"])
    vi.stubEnv(name, undefined)
  vi.stubEnv("CLOUDFLARE_ENV", "")
  await writeFile(
    join(directory, ".env.local"),
    [
      "SITE_URL=https://site.example.test",
      "MEDIA_ORIGIN=https://media.example.test",
      "SITE_UPDATED_AT=2024-02-29",
      "ANALYTICS_ENABLED=true",
      "SITE_URL_SECRET=must-remain-private",
      "DATABASE_URL=must-remain-private",
      "POSTHOG_PROJECT_TOKEN=must-remain-private",
    ].join("\n")
  )
})
afterEach(async () => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  await rm(directory, { recursive: true, force: true })
})

it("loads renamed public settings from dotenv without Git and excludes other variables", () => {
  expect(publicEnvDefinitions("production")).toEqual({
    "process.env.SITE_URL": '"https://site.example.test"',
    "process.env.MEDIA_ORIGIN": '"https://media.example.test"',
    "process.env.SITE_UPDATED_AT": '"2024-02-29"',
    "process.env.ANALYTICS_ENABLED": '"true"',
  })
})

it("lets CI shell settings override dotenv values in both browser builds", () => {
  vi.stubEnv("SITE_URL", "https://ci.example.test")
  vi.stubEnv("MEDIA_ORIGIN", "https://ci-media.example.test")
  vi.stubEnv("SITE_UPDATED_AT", "2026-10-14")
  vi.stubEnv("ANALYTICS_ENABLED", "false")
  expect(publicEnvDefinitions("production")).toEqual({
    "process.env.SITE_URL": '"https://ci.example.test"',
    "process.env.MEDIA_ORIGIN": '"https://ci-media.example.test"',
    "process.env.SITE_UPDATED_AT": '"2026-10-14"',
    "process.env.ANALYTICS_ENABLED": '"false"',
  })
})
