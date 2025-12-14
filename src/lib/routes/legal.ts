// Legal routes

// For Next.js app router paths
export const legalPaths = {
  terms: '/legal/terms',
  privacy: '/legal/privacy',
} as const

// For navigation - functions that generate actual URLs
export const legalRoutes = {
  terms: () => '/legal/terms',
  privacy: () => '/legal/privacy',
} as const
