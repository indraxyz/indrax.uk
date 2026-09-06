"use client"

import { createAuthClient } from "better-auth/react"

/**
 * The browser half of Better Auth: sign-in and sign-out, nothing else.
 *
 * No `baseURL` - the client defaults to the origin it was served from, which is
 * always correct and cannot be pointed somewhere else by a stale build-time
 * value on a preview deployment.
 */
export const authClient = createAuthClient()
