// Dashboard routes

// For Next.js app router paths
export const dashboardPaths = {
  root: '/dashboard',
} as const

// For navigation - functions that generate actual URLs
export const dashboardRoutes = {
  root: () => '/dashboard',
} as const
