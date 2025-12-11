import { authPaths, authRoutes } from './auth'
import { dashboardPaths, dashboardRoutes } from './dashboard'
import { discoverPaths, discoverRoutes } from './discover'
import { projectPaths, projectRoutes } from './project'
import { userPaths, userRoutes } from './user'

// Routes that don't require authentication
export const publicRoutes = [
  authRoutes.signIn(),
  authRoutes.signUp(),
  discoverRoutes.root(),
]

// All application routes
export const routes = {
  home: () => '/',
  auth: authRoutes,
  dashboard: dashboardRoutes,
  discover: discoverRoutes,
  project: projectRoutes,
  user: userRoutes,
} as const

// All application paths (for Next.js app router matching)
export const paths = {
  home: '/',
  auth: authPaths,
  dashboard: dashboardPaths,
  discover: discoverPaths,
  project: projectPaths,
  user: userPaths,
} as const

export type Routes = typeof routes
export type Paths = typeof paths

// Re-export types for convenience
export type { ProjectParams } from './project'
export type { UserParams } from './user'
