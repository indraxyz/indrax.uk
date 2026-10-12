import { afterEach, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ loadEnv: vi.fn() }))
vi.mock("vite", () => ({ loadEnv: mocks.loadEnv }))
vi.mock("./site-updated-at.ts", () => ({ resolveSiteUpdatedAt: () => "2026-10-12" }))
import { publicEnvDefinitions } from "./public-env"

afterEach(() => vi.unstubAllEnvs())

it.each([
  ["", "https://media.indrax.uk"],
  ["dev", "https://dev-media.indrax.uk"],
])("uses the matching R2 origin when CI's media setting is empty: %s", (env, origin) => {
  vi.stubEnv("CLOUDFLARE_ENV", env)
  mocks.loadEnv.mockReturnValue({ NEXT_PUBLIC_MEDIA_ORIGIN: "" })
  expect(publicEnvDefinitions("production")["process.env.NEXT_PUBLIC_MEDIA_ORIGIN"]).toBe(
    JSON.stringify(origin)
  )
})

it("preserves an explicit media-origin override", () => {
  mocks.loadEnv.mockReturnValue({ NEXT_PUBLIC_MEDIA_ORIGIN: "https://media.example.com" })
  expect(publicEnvDefinitions("production")["process.env.NEXT_PUBLIC_MEDIA_ORIGIN"]).toBe(
    JSON.stringify("https://media.example.com")
  )
})

it.each([
  ["", "https://media.indrax.uk"],
  ["dev", "https://dev-media.indrax.uk"],
])("does not embed the local media route in production builds: %s", (env, origin) => {
  vi.stubEnv("CLOUDFLARE_ENV", env)
  mocks.loadEnv.mockReturnValue({ NEXT_PUBLIC_MEDIA_ORIGIN: "http://localhost:5173/local-media" })
  expect(publicEnvDefinitions("production")["process.env.NEXT_PUBLIC_MEDIA_ORIGIN"]).toBe(
    JSON.stringify(origin)
  )
  expect(publicEnvDefinitions("development")["process.env.NEXT_PUBLIC_MEDIA_ORIGIN"]).toBe(
    JSON.stringify("http://localhost:5173/local-media")
  )
})
