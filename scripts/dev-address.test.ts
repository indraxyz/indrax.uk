import { describe, expect, it } from "vitest"

import { devAddress, hasAddressArgument } from "./dev-address.mjs"

describe("devAddress", () => {
  it("leaves Vite's defaults alone without a public URL", () => {
    expect(devAddress({})).toBeNull()
    expect(devAddress({ DEV_PUBLIC_URL: " ", DEV_HOST: "0.0.0.0", DEV_PORT: "5180" })).toBeNull()
  })

  it("reads the public origin, listen interface and port", () => {
    const address = devAddress({
      DEV_PUBLIC_URL: "https://indrax.uk.test",
      DEV_HOST: "172.26.0.1",
      DEV_PORT: "5180",
    })!
    expect(address.host).toBe("172.26.0.1")
    expect(address.port).toBe(5180)
    expect(address.publicUrl.origin).toBe("https://indrax.uk.test")
    expect(address.publicUrl.hostname).toBe("indrax.uk.test")
  })

  it("defaults to the loopback interface and Vite's port", () => {
    expect(devAddress({ DEV_PUBLIC_URL: "http://indrax.localhost" })).toMatchObject({
      host: "127.0.0.1",
      port: 5173,
    })
  })

  it.each([
    "indrax.uk.test",
    "ftp://indrax.uk.test",
    "https://indrax.uk.test/admin",
    "https://a@b.test",
  ])("rejects %s as a public origin", (value) =>
    expect(() => devAddress({ DEV_PUBLIC_URL: value })).toThrow(/DEV_PUBLIC_URL/)
  )

  it.each(["0", "70000", "51.8", "port"])("rejects port %s", (value) =>
    expect(() => devAddress({ DEV_PUBLIC_URL: "https://indrax.uk.test", DEV_PORT: value })).toThrow(
      /DEV_PORT/
    )
  )
})

describe("hasAddressArgument", () => {
  it("detects explicit host and port flags", () => {
    expect(hasAddressArgument(["--port", "3210", "--strictPort"])).toBe(true)
    expect(hasAddressArgument(["--host=0.0.0.0"])).toBe(true)
    expect(hasAddressArgument(["--open", "--strictPort"])).toBe(false)
    expect(hasAddressArgument([])).toBe(false)
  })
})
