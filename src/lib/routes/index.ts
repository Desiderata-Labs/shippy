import { authPaths, authRoutes } from './auth'
import { dashboardPaths, dashboardRoutes } from './dashboard'
import { discoverPaths, discoverRoutes } from './discover'
import { legalPaths, legalRoutes } from './legal'
import { projectPaths, projectRoutes } from './project'
import { userPaths, userRoutes } from './user'

// Routes that don't require authentication
export const publicRoutes = [
  authRoutes.signIn(),
  authRoutes.signUp(),
  discoverRoutes.root(),
  legalRoutes.terms(),
  legalRoutes.privacy(),
]

// All application routes
export const routes = {
  home: () => '/',
  auth: authRoutes,
  dashboard: dashboardRoutes,
  discover: discoverRoutes,
  legal: legalRoutes,
  project: projectRoutes,
  user: userRoutes,
} as const

// All application paths (for Next.js app router matching)
export const paths = {
  home: '/',
  auth: authPaths,
  dashboard: dashboardPaths,
  discover: discoverPaths,
  legal: legalPaths,
  project: projectPaths,
  user: userPaths,
} as const

export type Routes = typeof routes
export type Paths = typeof paths

// Re-export types and enums for convenience
export { DEFAULT_PROJECT_TAB, ProjectTab } from './project'
export type {
  BountyParams,
  PayoutDetailParams,
  ProjectParams,
  ProjectTabParams,
  SubmissionParams,
} from './project'
export type { UserParams } from './user'

// Re-export nanoid utilities for URL slug handling
export { createSlugWithId, extractNanoIdFromSlug } from '@/lib/nanoid/shared'
