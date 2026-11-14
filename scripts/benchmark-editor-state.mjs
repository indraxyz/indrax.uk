// Production-admin experiment: instrument only a temporary copy, never application files.
import { cp, mkdir, readFile, writeFile, symlink, realpath, rm, mkdtemp } from "node:fs/promises"
import { resolve, join, basename, extname } from "node:path"
import { spawnSync } from "node:child_process"
import { createServer } from "node:http"
import { createRequire } from "node:module"
import { tmpdir, cpus } from "node:os"
import { createHash } from "node:crypto"
const source = resolve(process.argv[2] || process.cwd())
const output = resolve(process.argv[3] || "/tmp/indrax-editor-benchmark-results.json")
const variant = process.argv[4] || "baseline"
const samples = Number(process.env.BENCH_SAMPLES || 7)
if (
  !["baseline", "memo"].includes(variant) ||
  !Number.isInteger(samples) ||
  samples < 1 ||
  samples > 50
)
  throw new Error("Use baseline|memo and BENCH_SAMPLES=1..50")
await mkdir(resolve(output, ".."), { recursive: true })
const sourceFiles = [
  "features/writing/components/admin/post-form.tsx",
  "features/writing/components/admin/editor.tsx",
  "features/writing/components/admin/use-post-form-controller.ts",
  "features/writing/utils/post-form-state.ts",
  "package-lock.json",
  "vite.admin.config.ts",
]
const hashes = {}
for (const file of sourceFiles) {
  try {
    hashes[file] = createHash("sha256")
      .update(await readFile(join(source, file)))
      .digest("hex")
  } catch (e) {
    if (e.code !== "ENOENT") throw e
  }
}
const revision = spawnSync("git", ["rev-parse", "HEAD"], {
  cwd: source,
  encoding: "utf8",
}).stdout.trim()
let server, browser
const work = await mkdtemp(join(tmpdir(), "indrax-editor-bench-"))
try {
  const root = join(work, "source")
  const excluded = new Set([
    ".git",
    "node_modules",
    "build",
    "public",
    "test-results",
    "playwright-report",
    ".react-router",
    ".wrangler",
    ".agents",
    ".codex",
    ".aws",
  ])
  await cp(source, root, {
    recursive: true,
    filter: (p) =>
      !excluded.has(basename(p)) &&
      !basename(p).startsWith(".env") &&
      !basename(p).startsWith(".dev.vars"),
  })
  await symlink(await realpath(join(source, "node_modules")), join(root, "node_modules"))
  async function patch(path, from, to) {
    const file = join(root, path),
      text = await readFile(file, "utf8")
    if (typeof from === "string" ? !text.includes(from) : !from.test(text))
      throw new Error(`Instrumentation anchor missing: ${path}: ${from}`)
    await writeFile(file, text.replace(from, to))
  }
  const helper = `import { useLayoutEffect } from "react"\nexport function benchCommit(name: string) { useLayoutEffect(() => { const b = (window as any).__editorBench; if (b) b.commits[name] = (b.commits[name] || 0) + 1 }) }\nexport function benchTime<T>(name: string, task: () => T): T { const start = performance.now(); try { return task() } finally { const b = (globalThis as any).__editorBench; if (b) (b.timings[name] ||= []).push(performance.now() - start) } }\n`
  await writeFile(join(root, "features/writing/bench.ts"), helper)
  for (const path of [
    "features/writing/components/admin/post-form.tsx",
    "features/writing/components/admin/editor.tsx",
  ]) {
    await patch(
      path,
      "import ",
      'import { benchCommit, benchTime } from "@/features/writing/bench"\nimport '
    )
  }
  await patch(
    "features/writing/components/admin/post-form.tsx",
    "export function PostForm({ post, coverUploadsConfigured, children }: PostFormProps) {",
    'export function PostForm({ post, coverUploadsConfigured, children }: PostFormProps) {\n benchCommit("PostForm")'
  )
  await patch(
    "features/writing/components/admin/editor.tsx",
    "export function PostEditor({ value, onChange, imageUploadsConfigured = false }: EditorProps) {",
    'export function PostEditor({ value, onChange, imageUploadsConfigured = false }: EditorProps) {\n benchCommit("PostEditor")'
  )
  await patch(
    "features/writing/components/admin/editor.tsx",
    "  // Tiptap v3",
    '  benchCommit("Toolbar")\n  // Tiptap v3'
  )
  await patch(
    "features/writing/components/admin/editor.tsx",
    "onChange(instance.getJSON() as PostDocument)",
    'onChange(benchTime("getJSON", () => instance.getJSON()) as PostDocument)'
  )
  await patch(
    "features/writing/utils/post-form-state.ts",
    "import ",
    'import { benchTime } from "@/features/writing/bench"\nimport '
  )
  await patch(
    "features/writing/utils/post-form-state.ts",
    "return JSON.stringify(fields)",
    'return benchTime("snapshot", () => JSON.stringify(fields))'
  )
  if (variant === "memo") {
    await patch(
      "features/writing/components/admin/editor.tsx",
      "import { EditorContent",
      'import { memo } from "react"\nimport { EditorContent'
    )
    await patch(
      "features/writing/components/admin/editor.tsx",
      "export function PostEditor(",
      "function PostEditorComponent("
    )
    await writeFile(
      join(root, "features/writing/components/admin/editor.tsx"),
      (await readFile(join(root, "features/writing/components/admin/editor.tsx"), "utf8")) +
        "\nexport const PostEditor = memo(PostEditorComponent)\n"
    )
    await patch(
      "features/writing/components/admin/post-form.tsx",
      "  useState,",
      "  useState,\n  useCallback,"
    )
    await patch(
      "features/writing/components/admin/post-form.tsx",
      "const setBody = (body: PostDocument) => updateFields({ body })",
      "const updateFieldsRef = useRef(updateFields)\n updateFieldsRef.current = updateFields\n const setBody = useCallback((body: PostDocument) => updateFieldsRef.current({ body }), [])"
    )
    await patch(
      "features/writing/components/admin/post-form.tsx",
      /onChange=\{\(value\) => \{\s+setBody\(value\)\s+\}\}/,
      "onChange={setBody}"
    )
  }
  const env = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    SITE_UPDATED_AT: "2026-11-14",
    ANALYTICS_ENABLED: "false",
  }
  const built = spawnSync(
    join(root, "node_modules/.bin/vite"),
    ["build", "--config", "vite.admin.config.ts", "--mode", "production"],
    { cwd: root, env, encoding: "utf8" }
  )
  await writeFile(output + ".build.log", built.stdout + built.stderr)
  if (built.error || built.status !== 0) throw new Error(`Build failed: ${output}.build.log`)
  const assets = join(root, "build/client/admin")
  server = createServer(async (req, res) => {
    try {
      let path = decodeURIComponent(new URL(req.url, "http://localhost").pathname)
      if (!path.startsWith("/admin/") || path.includes("..") || path.includes("\\")) {
        res.writeHead(404)
        res.end()
        return
      }
      let file = join(assets, path.replace(/^\/admin\/?/, ""))
      if (!extname(path)) file = join(assets, "index.html")
      const types = {
        ".js": "text/javascript",
        ".css": "text/css",
        ".html": "text/html",
        ".svg": "image/svg+xml",
        ".woff2": "font/woff2",
      }
      res.setHeader("Content-Type", types[extname(file)] || "application/octet-stream")
      res.end(await readFile(file))
    } catch {
      res.writeHead(404)
      res.end()
    }
  })
  await new Promise((r, reject) => {
    server.on("error", reject)
    server.listen(0, "127.0.0.1", r)
  })
  const origin = `http://127.0.0.1:${server.address().port}`
  const require = createRequire(join(source, "package.json"))
  const { chromium } = require("@playwright/test")
  browser = await chromium.launch({ headless: true })
  const id = "550e8400-e29b-41d4-a716-446655440000"
  const text =
    "Deterministic article paragraph covering editor state, rendering and practical engineering tradeoffs. ".repeat(
      4
    )
  const results = []
  for (let sample = 0; sample < samples; sample++)
    for (const paragraphs of [10, 400])
      for (const target of ["title", "excerpt", "body"]) {
        const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
        const page = await context.newPage(),
          errors = [],
          requests = []
        page.on("pageerror", (e) => errors.push(e.message))
        await context.addCookies([
          { name: "better-auth.session_token", value: "browser-fixture", url: origin },
        ])
        const post = {
          id,
          slug: "benchmark-post",
          title: "Benchmark title",
          excerpt: "Benchmark excerpt",
          coverUrl: null,
          coverAlt: null,
          publishedAt: null,
          updatedAt: "2026-01-01T00:00:00Z",
          tags: [],
          content: {
            type: "doc",
            content: Array.from({ length: paragraphs }, () => ({
              type: "paragraph",
              content: [{ type: "text", text }],
            })),
          },
          status: "draft",
          seriesTitle: null,
          seriesDescription: null,
          seriesOrder: null,
        }
        await page.route("**/api/**", (route) => {
          const path = new URL(route.request().url()).pathname
          requests.push({ path, method: route.request().method() })
          if (path === "/api/admin/session")
            return route.fulfill({
              json: {
                author: { id: "author", name: "Author", email: "author@example.test" },
                authConfigured: true,
                coverUploadsConfigured: false,
                databaseConfigured: true,
                previewConfigured: true,
              },
            })
          if (path === `/api/admin/posts/${id}`) return route.fulfill({ json: post })
          if (path === "/api/admin/tags") return route.fulfill({ json: [] })
          errors.push(`Unexpected API: ${route.request().method()} ${path}`)
          return route.fulfill({ status: 500, json: { error: "Unexpected benchmark request" } })
        })
        await page.goto(`${origin}/admin/posts/edit/${id}`)
        await page.locator(".tiptap").waitFor()
        const field = target === "body" ? page.locator(".tiptap") : page.locator(`#${target}`)
        await field.click()
        await page.keyboard.press("ControlOrMeta+End")
        await page.keyboard.type("warmup")
        await page.waitForTimeout(100)
        await page.evaluate(() => {
          window.__editorBench = { commits: {}, timings: {}, frames: [], longTasks: [] }
          new PerformanceObserver((list) =>
            window.__editorBench.longTasks.push(...list.getEntries().map((e) => e.duration))
          ).observe({ type: "longtask", buffered: false })
          document.addEventListener(
            "input",
            () => {
              const start = performance.now()
              requestAnimationFrame(() =>
                window.__editorBench.frames.push(performance.now() - start)
              )
            },
            { capture: true }
          )
        })
        const start = performance.now()
        await page.keyboard.type("abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ", {
          delay: 20,
        })
        await page.waitForTimeout(100)
        const elapsed = performance.now() - start
        const metrics = await page.evaluate(() => window.__editorBench)
        if (errors.length) throw new Error(errors.join("\n"))
        if (metrics.frames.length !== 62)
          throw new Error("Expected one input frame sample for each typed character")
        if (requests.some((r) => r.method !== "GET")) throw new Error("Unexpected mutation")
        const row = {
          sample,
          paragraphs,
          target,
          documentBytes: Buffer.byteLength(JSON.stringify(post.content)),
          elapsed,
          metrics,
          requests,
        }
        results.push(row)
        console.log(
          JSON.stringify({
            variant,
            sample,
            paragraphs,
            target,
            commits: metrics.commits,
            frames: metrics.frames.length,
          })
        )
        await context.close()
      }
  await writeFile(
    output,
    JSON.stringify(
      {
        variant,
        samples,
        source: { revision, hashes },
        environment: {
          node: process.version,
          cpu: cpus()[0]?.model,
          logicalCpus: cpus().length,
          measuredAt: new Date().toISOString(),
          browser: browser.version(),
          platform: process.platform,
          arch: process.arch,
          viewport: { width: 1440, height: 1000 },
          headless: true,
          production: true,
        },
        results,
      },
      null,
      2
    )
  )
} finally {
  await browser?.close()
  if (server?.listening) await new Promise((r) => server.close(r))
  await rm(work, { recursive: true, force: true })
}
