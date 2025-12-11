// Discover routes

// For Next.js app router paths
export const discoverPaths = {
  root: '/discover',
} as const

// For navigation - functions that generate actual URLs
export const discoverRoutes = {
  root: () => '/discover',
} as const
