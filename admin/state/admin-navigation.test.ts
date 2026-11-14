import { expect, it } from "vitest"
import { createAdminNavigationStore, selectAdminNavigationOpen } from "./admin-navigation"

it("keeps the header pinned when a nested menu closes inside an open drawer", () => {
  const store = createAdminNavigationStore()
  store.getState().setDrawerOpen(true)
  store.getState().setPublicOpen("mobile", true)
  store.getState().setPublicOpen("mobile", false)
  expect(selectAdminNavigationOpen(store.getState())).toBe(true)
  store.getState().setDrawerOpen(false)
  expect(selectAdminNavigationOpen(store.getState())).toBe(false)
})

it("closes nested menus with the drawer and resets all transient navigation", () => {
  const store = createAdminNavigationStore()
  store.getState().setDrawerOpen(true)
  store.getState().setPublicOpen("mobile", true)
  store.getState().setDrawerOpen(false)
  expect(store.getState().mobilePublicOpen).toBe(false)
  store.getState().setPublicOpen("desktop", true)
  expect(selectAdminNavigationOpen(store.getState())).toBe(true)
  store.getState().reset()
  expect(selectAdminNavigationOpen(store.getState())).toBe(false)
})

it("isolates independent navigation stores", () => {
  const first = createAdminNavigationStore()
  const second = createAdminNavigationStore()
  first.getState().setDrawerOpen(true)
  expect(second.getState().drawerOpen).toBe(false)
})
