'use client'

import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient({
  // Base URL is inferred from the current domain
})

// Export commonly used methods for convenience
export const { signIn, signUp, signOut, useSession } = authClient
