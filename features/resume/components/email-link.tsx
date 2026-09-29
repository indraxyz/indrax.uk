"use client"

import { captureEvent } from "@/lib/analytics"

export function EmailLink({ email }: { email: string }) {
  return (
    <a
      href={`mailto:${email}`}
      className="underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      onClick={() => captureEvent("contact_clicked", { channel: "email" })}
    >
      {email}
    </a>
  )
}
