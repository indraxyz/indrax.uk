import { EventEmitter } from "node:events"
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, isAbsolute, join } from "node:path"
import { parseEnv } from "node:util"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { runPreview } from "../scripts/preview.mjs"
import { preparePreviewEnvironment } from "../scripts/preview-env.mjs"

let root: string
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "indrax-preview-test-"))
})
afterEach(() => rm(root, { recursive: true, force: true }))
const prepare = (env: Record<string, string | undefined> = {}, port = "3000") =>
  preparePreviewEnvironment({ root, port, env, temporaryRoot: root })

it("uses an absolute project local file despite the generated config living in build/server", async () => {
  await writeFile(
    join(root, ".env.local"),
    "BETTER_AUTH_URL=http://127.0.0.1:3000\nDATABASE_URL=local"
  )
  const result = await prepare()
  expect(result.args).toEqual(["--env-file", join(root, ".env.local")])
  expect(isAbsolute(result.args[1])).toBe(true)
  await result.cleanup()
  expect(await readdir(root)).toEqual([".env.local"])
})
it("shell fixtures override local database/auth bindings through the last env-file without changing the user's file", async () => {
  const original =
    "DATABASE_URL=developer-db\nBETTER_AUTH_SECRET=developer-secret\nBETTER_AUTH_URL=http://127.0.0.1:5173\n"
  await writeFile(join(root, ".env.local"), original)
  const result = await prepare(
    {
      DATABASE_URL: "test-db",
      BETTER_AUTH_SECRET: "test-secret",
      ALLOWED_GITHUB_ID: "fixture-author",
      GITHUB_CLIENT_ID: "",
      GITHUB_CLIENT_SECRET: "fixture-oauth",
    },
    "3017"
  )
  expect(result.args[0]).toBe("--env-file")
  expect(result.args[2]).toBe("--env-file")
  const file = result.args[3]
  expect(file).not.toContain("build/server")
  const vars = parseEnv(await readFile(file, "utf8"))
  expect(vars).toMatchObject({
    DATABASE_URL: "test-db",
    BETTER_AUTH_SECRET: "test-secret",
    BETTER_AUTH_URL: "http://127.0.0.1:3017",
    ALLOWED_GITHUB_ID: "fixture-author",
    GITHUB_CLIENT_ID: "",
  })
  expect(await readFile(join(root, ".env.local"), "utf8")).toBe(original)
  expect((await stat(file)).mode & 0o777).toBe(0o600)
  expect((await stat(dirname(file))).mode & 0o777).toBe(0o700)
  await result.cleanup()
  await expect(stat(file)).rejects.toMatchObject({ code: "ENOENT" })
})
it("supports shell-only CI without a local file and excludes unrelated process credentials", async () => {
  const result = await prepare({
    DATABASE_URL: "fixture-db",
    R2_SECRET_ACCESS_KEY: "fixture-r2",
    AWS_SECRET_ACCESS_KEY: "must-not-copy",
    PATH: "/bin",
    DIRECT_DATABASE_URL: "tooling-only",
  })
  const vars = parseEnv(await readFile(result.args[3], "utf8"))
  expect(vars).toEqual({
    DATABASE_URL: "fixture-db",
    R2_SECRET_ACCESS_KEY: "fixture-r2",
    BETTER_AUTH_URL: "http://127.0.0.1:3000",
  })
  await result.cleanup()
})
it("preserves an explicit shell callback origin and empty values", async () => {
  const result = await prepare(
    { BETTER_AUTH_URL: "http://localhost:3100", GITHUB_CLIENT_SECRET: "" },
    "3100"
  )
  expect(parseEnv(await readFile(result.args[3], "utf8"))).toMatchObject({
    BETTER_AUTH_URL: "http://localhost:3100",
    GITHUB_CLIENT_SECRET: "",
  })
  await result.cleanup()
  await result.cleanup()
})
it("preserves hashes, literal backslashes and multiline fixture secrets without interpolation", async () => {
  const secret = "value#hash\\nliteral\nsecond line"
  const result = await prepare({ BETTER_AUTH_SECRET: secret })
  expect(parseEnv(await readFile(result.args[3], "utf8")).BETTER_AUTH_SECRET).toBe(secret)
  await result.cleanup()
})
it("does not create an override file when the local file already matches shell and preview settings", async () => {
  await writeFile(
    join(root, ".env.local"),
    "DATABASE_URL=fixture-db\nBETTER_AUTH_URL=http://127.0.0.1:3300"
  )
  const result = await prepare({ DATABASE_URL: "fixture-db" }, "3300")
  expect(result.args).toHaveLength(2)
  await result.cleanup()
})
it("cleans a partially created directory when preparing its override file fails", async () => {
  await writeFile(join(root, "not-directory"), "file")
  await expect(
    preparePreviewEnvironment({
      root,
      port: "3000",
      env: {},
      temporaryRoot: join(root, "not-directory"),
    })
  ).rejects.toMatchObject({ code: "ENOTDIR" })
  expect(await readdir(root)).toEqual(["not-directory"])
})

it.each(["exit", "spawn-error", "initialize-error", "SIGINT", "SIGTERM"])(
  "cleans transient env files and signal handlers after %s",
  async (outcome) => {
    const signals = new EventEmitter()
    const child = new EventEmitter() as EventEmitter & { kill: ReturnType<typeof vi.fn> }
    child.kill = vi.fn((signal) => {
      child.emit("exit", null, signal)
      return true
    })
    let envFile: string | undefined
    const launch = vi.fn(
      (
        _command: string,
        args: string[],
        options: { cwd?: string; env?: Record<string, string | undefined> }
      ) => {
        expect(options.cwd).toBe(root)
        expect(options.env?.CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV).toBe("true")
        expect(options.env?.CLOUDFLARE_INCLUDE_PROCESS_ENV).toBe("false")
        expect(args[args.indexOf("--config") + 1]).toBe(join(root, "build/server/wrangler.json"))
        expect(args[args.indexOf("--local-upstream") + 1]).toBe("127.0.0.1:3900")
        envFile = args[args.lastIndexOf("--env-file") + 1]
        queueMicrotask(() => {
          if (outcome === "spawn-error") child.emit("error", new Error("spawn failed"))
          else if (outcome.startsWith("SIG")) signals.emit(outcome)
          else child.emit("exit", 0, null)
        })
        return child
      }
    )
    const initializeCache = vi.fn(async () => {
      if (outcome === "initialize-error") throw new Error("initialize failed")
    })
    const run = runPreview({
      root,
      argv: ["--port", "3900"],
      env: { DATABASE_URL: "fixture-db" },
      launch: launch as never,
      initializeCache,
      signals: signals as never,
    })
    if (outcome.endsWith("error"))
      await expect(run).rejects.toThrow(
        outcome === "initialize-error" ? "initialize failed" : "spawn failed"
      )
    else expect(await run).toBe(outcome === "SIGINT" ? 130 : outcome === "SIGTERM" ? 143 : 0)
    if (envFile) await expect(stat(envFile)).rejects.toMatchObject({ code: "ENOENT" })
    expect(signals.listenerCount("SIGINT")).toBe(0)
    expect(signals.listenerCount("SIGTERM")).toBe(0)
    expect(await readdir(root)).toEqual([])
  }
)
