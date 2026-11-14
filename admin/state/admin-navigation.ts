import { createStore } from "zustand/vanilla"

export function createAdminNavigationStore() {
  return createStore<{
    drawerOpen: boolean
    desktopPublicOpen: boolean
    mobilePublicOpen: boolean
    setDrawerOpen: (open: boolean) => void
    setPublicOpen: (location: "desktop" | "mobile", open: boolean) => void
    reset: () => void
  }>((set) => ({
    drawerOpen: false,
    desktopPublicOpen: false,
    mobilePublicOpen: false,
    setDrawerOpen: (open) => set({ drawerOpen: open, mobilePublicOpen: false }),
    setPublicOpen: (location, open) =>
      set(location === "desktop" ? { desktopPublicOpen: open } : { mobilePublicOpen: open }),
    reset: () => set({ drawerOpen: false, desktopPublicOpen: false, mobilePublicOpen: false }),
  }))
}

/** This module is imported only by the independent CSR admin application. */
export const adminNavigationStore = createAdminNavigationStore()
export const resetAdminNavigation = () => adminNavigationStore.getState().reset()
export const selectAdminNavigationOpen = (
  state: ReturnType<typeof adminNavigationStore.getState>
) => state.drawerOpen || state.desktopPublicOpen || state.mobilePublicOpen
