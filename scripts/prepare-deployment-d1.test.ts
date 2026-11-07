import { readFile, stat } from "node:fs/promises"
import { expect, it, vi } from "vitest"
import { deploymentD1Config, prepareDeploymentD1 } from "./prepare-deployment-d1.mjs"

const production = {
  binding: "APP_D1",
  database_id: "production-id",
  database_name: "production-db",
}
const staging = { binding: "APP_D1", database_id: "staging-id", database_name: "staging-db" }
const source = { name: "indrax", d1_databases: [production], previews: { d1_databases: [staging] } }

it.each([
  ["production", production],
  ["staging", staging],
] as const)(
  "selects only the explicit %s D1 binding without a Worker configuration",
  (target, database) => {
    expect(deploymentD1Config(source, target)).toEqual({ d1_databases: [database] })
  }
)

it.each([
  { d1_databases: [] },
  { d1_databases: [staging, staging] },
  { d1_databases: [{ ...staging, database_id: "" }] },
  { d1_databases: [{ ...staging, database_id: production.database_id }] },
  { d1_databases: [{ ...staging, database_name: production.database_name }] },
])("refuses missing, ambiguous or production staging targets: %j", (previews) => {
  expect(() => deploymentD1Config({ ...source, previews }, "staging")).toThrow()
})

it.each([false, true])(
  "cleans up its database-only config after success/failure (%s)",
  async (fail) => {
    let file = ""
    const run = vi.fn(async (_command: string, args: string[]) => {
      file = args[args.indexOf("--config") + 1]
      expect(JSON.parse(await readFile(file, "utf8"))).toEqual({ d1_databases: [staging] })
      expect((await stat(file)).mode & 0o777).toBe(0o600)
      expect(args).toEqual(
        expect.arrayContaining(["d1", "execute", "APP_D1", "--remote", "--file"])
      )
      expect(args[args.indexOf("--env") + 1]).toBe("")
      if (fail) throw new Error("Database unavailable")
      return { stdout: "", stderr: "" }
    })
    const job = prepareDeploymentD1("staging", { source, run })
    if (fail) await expect(job).rejects.toThrow("Database unavailable")
    else await job
    await expect(stat(file)).rejects.toMatchObject({ code: "ENOENT" })
  }
)

it("refuses the retired dev target without executing Wrangler", async () => {
  const run = vi.fn()
  await expect(prepareDeploymentD1("dev", { source, run })).rejects.toThrow("Choose")
  expect(run).not.toHaveBeenCalled()
})
