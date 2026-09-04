"use client"

import { useEffect } from "react"

import { startAnalytics } from "@/lib/analytics"

// Mounted once from the root layout. Starting the tracker inside an effect keeps it
// out of the server render and off the first paint; it renders nothing itself.
export function PostHogAnalytics() {
  useEffect(() => {
    startAnalytics()
  }, [])

  return null
}
