'use client'

import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient({
  // Base URL is inferred from the current domain
})

// Infer types from the auth client with additional user fields
export type Session = typeof authClient.$Infer.Session & {
  user: {
    username?: string | null
  }
}

// Export commonly used methods for convenience
export const { signIn, signUp, signOut, useSession, linkSocial, listAccounts } =
  authClient
