import { expect, it, vi } from "vitest"
import { readJson } from "./request-body.server"
const headers = { origin: "https://test.example", "content-type": "application/json" }

it("times out a stalled body even if the sender's cancellation stalls", async () => {
  const { readBoundedBody } = await import("./request-body.server")
  vi.useFakeTimers()
  const cancel = vi.fn(() => new Promise<void>(() => {}))
  const request = new Request("https://example.test", {
    method: "POST",
    body: new ReadableStream<Uint8Array>({ cancel }),
    duplex: "half",
  } as RequestInit)
  try {
    const result = expect(readBoundedBody(request, 1024, 100)).rejects.toMatchObject({
      status: 408,
    })
    await vi.advanceTimersByTimeAsync(100)
    await result
    expect(cancel).toHaveBeenCalledOnce()
    expect(request.body!.locked).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  } finally {
    vi.useRealTimers()
  }
})

it("bounds total body time even while chunks keep arriving", async () => {
  const { readBoundedBody } = await import("./request-body.server")
  vi.useFakeTimers()
  let controller: ReadableStreamDefaultController<Uint8Array>
  const cancel = vi.fn()
  const request = new Request("https://example.test", {
    method: "POST",
    body: new ReadableStream<Uint8Array>({
      start(value) {
        controller = value
      },
      cancel,
    }),
    duplex: "half",
  } as RequestInit)
  try {
    const result = expect(readBoundedBody(request, 1024, 100)).rejects.toMatchObject({
      status: 408,
    })
    controller!.enqueue(new Uint8Array([1]))
    await vi.advanceTimersByTimeAsync(60)
    controller!.enqueue(new Uint8Array([2]))
    await vi.advanceTimersByTimeAsync(40)
    await result
    expect(cancel).toHaveBeenCalledOnce()
  } finally {
    vi.useRealTimers()
  }
})

it("returns from draining a stalled rejected body within its deadline", async () => {
  const { discardBody } = await import("./request-body.server")
  vi.useFakeTimers()
  const cancel = vi.fn(() => new Promise<void>(() => {}))
  const request = new Request("https://example.test", {
    method: "POST",
    body: new ReadableStream<Uint8Array>({ cancel }),
    duplex: "half",
  } as RequestInit)
  try {
    const result = discardBody(request, 1024, 100)
    await vi.advanceTimersByTimeAsync(100)
    await result
    expect(cancel).toHaveBeenCalledOnce()
    expect(request.body!.locked).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  } finally {
    vi.useRealTimers()
  }
})

it("clears the deadline after a complete body", async () => {
  const { readBoundedBody } = await import("./request-body.server")
  vi.useFakeTimers()
  try {
    await readBoundedBody(new Request("https://example.test", { method: "POST", body: "ok" }), 10)
    expect(vi.getTimerCount()).toBe(0)
  } finally {
    vi.useRealTimers()
  }
})
it("rejects oversized streamed JSON without relying on Content-Length", async () => {
  const request = new Request("https://test.example/api", {
    method: "POST",
    headers,
    body: JSON.stringify({ data: "x".repeat(100) }),
  })
  await expect(readJson(request, 32)).rejects.toMatchObject({ status: 413 })
})
it("rejects cross-origin and non-JSON mutations before body parsing", async () => {
  await expect(
    readJson(
      new Request("https://test.example/api", {
        method: "POST",
        headers: { ...headers, origin: "https://other.example" },
        body: "{}",
      })
    )
  ).rejects.toMatchObject({ status: 403 })
  await expect(
    readJson(
      new Request("https://test.example/api", {
        method: "POST",
        headers: { ...headers, "content-type": "text/plain" },
        body: "{}",
      })
    )
  ).rejects.toMatchObject({ status: 415 })
})
it("rejects malformed JSON and reads valid bounded JSON", async () => {
  await expect(
    readJson(new Request("https://test.example/api", { method: "POST", headers, body: "{" }))
  ).rejects.toMatchObject({ status: 400 })
  await expect(
    readJson(
      new Request("https://test.example/api", {
        method: "POST",
        headers,
        body: '{"title":"saved"}',
      })
    )
  ).resolves.toEqual({ title: "saved" })
})

it("reads a bounded binary body and refuses a missing one", async () => {
  const { readBoundedBody } = await import("./request-body.server")
  const bytes = new Uint8Array([1, 2, 3])
  expect(
    await readBoundedBody(new Request("https://example.test", { method: "POST", body: bytes }), 3)
  ).toEqual(bytes)
  await expect(
    readBoundedBody(new Request("https://example.test", { method: "POST", body: bytes }), 2)
  ).rejects.toMatchObject({ status: 413 })
  await expect(
    readBoundedBody(new Request("https://example.test", { method: "POST" }), 2)
  ).rejects.toMatchObject({ status: 400 })
})

it("discards a body up to a limit, and cancels one declared or found to be larger", async () => {
  const { discardBody } = await import("./request-body.server")
  const small = new Request("https://example.test", { method: "POST", body: new Uint8Array(10) })
  await discardBody(small, 100)
  expect(small.bodyUsed).toBe(true)

  let pulled = 0
  let cancelled = false
  const endless = new ReadableStream<Uint8Array>({
    pull(controller) {
      pulled += 1
      controller.enqueue(new Uint8Array(64))
    },
    cancel() {
      cancelled = true
    },
  })
  await discardBody(
    new Request("https://example.test", {
      method: "POST",
      body: endless,
      duplex: "half",
    } as RequestInit),
    1024
  )
  expect(cancelled).toBe(true)
  expect(pulled).toBeLessThan(40)

  let read = false
  const declared = new ReadableStream<Uint8Array>({
    pull() {
      read = true
    },
  })
  await discardBody(
    new Request("https://example.test", {
      method: "POST",
      body: declared,
      headers: { "content-length": "999999" },
      duplex: "half",
    } as RequestInit),
    1024
  )
  expect(read).toBe(false)
})
