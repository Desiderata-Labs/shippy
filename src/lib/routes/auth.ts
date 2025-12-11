// Auth routes (sign-in, sign-up, onboarding)

// For Next.js app router paths
export const authPaths = {
  signIn: '/sign-in',
  signUp: '/sign-up',
  onboarding: '/onboarding',
} as const

// For navigation - functions that generate actual URLs
export const authRoutes = {
  signIn: () => '/sign-in',
  signUp: () => '/sign-up',
  onboarding: () => '/onboarding',
} as const
