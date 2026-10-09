import { expect, it } from "vitest"
import { readJson } from "./request-body.server"
const headers = { origin: "https://test.example", "content-type": "application/json" }
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
