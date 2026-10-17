import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { expect, test } from "@playwright/test"
import {
  createTestHarness,
  unstable_splitSqlQuery as splitSqlQuery,
  unstable_readConfig,
  type TestHarness,
} from "wrangler"
import { ANALYTICS_GATEWAY_TOKEN as PLACEHOLDER } from "../lib/analytics-gateway"

const TOKEN = "phc_runtime_fixture"
const origin = "https://indrax.uk"
const source = unstable_readConfig({ config: "wrangler.jsonc", env: "" })
let server: TestHarness | undefined
let directory: string | undefined

test.describe("analytics in Workerd", () => {
  test.describe.configure({ mode: "serial" })
  test.beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), "indrax-analytics-runtime-"))
    const configPath = join(directory, "wrangler.json")
    await writeFile(
      configPath,
      JSON.stringify({
        name: "analytics-runtime-test",
        main: resolve("e2e/support/analytics-runtime-worker.ts"),
        compatibility_date: source.compatibility_date,
        compatibility_flags: source.compatibility_flags,
        d1_databases: [
          {
            binding: "APP_D1",
            database_name: "analytics-runtime-test",
            database_id: "00000000-0000-0000-0000-000000000001",
          },
        ],
        ratelimits: [
          { name: "RATE_LIMIT_API", namespace_id: "1", simple: { limit: 120, period: 60 } },
        ],
      })
    )
    server = createTestHarness({
      root: directory,
      workers: [
        {
          configPath,
          secrets: { POSTHOG_PROJECT_TOKEN: TOKEN },
          vars: { POSTHOG_HOST: "https://us.i.posthog.com" },
        },
      ],
    })
    await server.listen()
    const { APP_D1 } = await server!.getWorker<{ APP_D1: D1Database }>().getEnv()
    const schema = await readFile("config/analytics-quota.sql", "utf8")
    for (const sql of splitSqlQuery(schema)) await APP_D1.prepare(sql).run()
  })
  test.afterAll(async () => {
    try {
      await server?.close()
    } finally {
      if (directory) await rm(directory, { recursive: true, force: true })
    }
  })

  test("refuses the retired /api/analytics namespace in Workerd", async () => {
    const response = await server!.fetch(`${origin}/api/analytics/e/`, {
      method: "POST",
      headers: {
        Origin: origin,
        "CF-Connecting-IP": "198.51.100.1",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ event: "$pageview", properties: { distinct_id: "visitor" } }),
    })
    expect(response.status).toBe(404)
  })

  for (const suffix of ["", ".js"]) {
    test(`serves SDK configuration${suffix} using runtime-compatible fetch options`, async () => {
      const response = await server!.fetch(
        `${origin}/analytics/array/${PLACEHOLDER}/config${suffix}`,
        {
          headers: { Referer: `${origin}/`, "CF-Connecting-IP": "198.51.100.1" },
        }
      )
      expect(response.status).toBe(200)
      expect(response.headers.get("content-type")).toContain(
        suffix ? "text/javascript" : "application/json"
      )
      const body = await response.text()
      expect(body).toContain(PLACEHOLDER)
      expect(body).not.toContain(TOKEN)
    })
  }

  test("forwards SDK pageview and flags requests with the server credential", async () => {
    for (const path of ["/e/", "/flags/"]) {
      const payload =
        path === "/flags/"
          ? { token: PLACEHOLDER, distinct_id: "runtime-visitor" }
          : {
              api_key: PLACEHOLDER,
              batch: [
                {
                  event: "$pageview",
                  properties: { token: PLACEHOLDER, distinct_id: "runtime-visitor" },
                },
              ],
            }
      const response = await server!.fetch(`${origin}/analytics${path}`, {
        method: "POST",
        headers: {
          Origin: origin,
          "Content-Type": "application/json",
          "CF-Connecting-IP": "198.51.100.1",
        },
        body: JSON.stringify(payload),
      })
      expect(response.status).toBe(200)
      expect(await response.text()).not.toContain(TOKEN)
    }
    const { APP_D1 } = await server!.getWorker<{ APP_D1: D1Database }>().getEnv()
    expect(
      await APP_D1.prepare(
        "SELECT category, units FROM analytics_quota WHERE category IN ('events', 'flags') ORDER BY category"
      ).all()
    ).toMatchObject({
      results: [
        { category: "events", units: 1 },
        { category: "flags", units: 1 },
      ],
    })
  })

  test("forwards a mixed pageview/heatmap batch in Workerd with server credentials", async () => {
    const response = await server!.fetch(`${origin}/analytics/i/v0/e/`, {
      method: "POST",
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        "CF-Connecting-IP": "198.51.100.1",
      },
      body: JSON.stringify({
        api_key: PLACEHOLDER,
        batch: [
          { event: "$pageview", properties: { distinct_id: "runtime-visitor" } },
          {
            event: "$$heatmap",
            properties: {
              distinct_id: "runtime-visitor",
              $heatmap_data: {
                [`${origin}/preview?token=runtime-bearer`]: [
                  { x: -0.5, y: 12.25, type: "mousemove", target_fixed: false },
                ],
              },
            },
          },
        ],
      }),
    })
    expect(response.status).toBe(200)
    const { APP_D1 } = await server!.getWorker<{ APP_D1: D1Database }>().getEnv()
    expect(
      await APP_D1.prepare("SELECT units FROM analytics_quota WHERE category='events'").first()
    ).toEqual({ units: 3 })
  })

  for (const asset of [
    "recorder",
    "web-vitals",
    "web-vitals-with-attribution",
    "dead-clicks-autocapture",
  ]) {
    test(`serves ${asset} assets through the runtime gateway`, async () => {
      for (const path of [`/static/1.434.18/${asset}.js`, `/static/${asset}.js?v=1.434.18`]) {
        const response = await server!.fetch(`${origin}/analytics${path}`, {
          headers: { Referer: `${origin}/`, "CF-Connecting-IP": "198.51.100.1" },
        })
        expect(response.status).toBe(200)
        expect(response.headers.get("content-type")).toContain("text/javascript")
      }
    })
  }

  for (const status of [301, 302, 303, 307, 308]) {
    test(`refuses upstream HTTP ${status} without following it`, async () => {
      const response = await server!.fetch(
        `${origin}/analytics/array/${PLACEHOLDER}/config?v=${status}`,
        {
          headers: { Referer: `${origin}/`, "CF-Connecting-IP": "198.51.100.1" },
        }
      )
      expect(response.status).toBe(502)
      expect(response.headers.has("location")).toBe(false)
      expect(await response.json()).toEqual({ ok: false })
    })
  }
})
