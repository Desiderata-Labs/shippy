// User routes (/u/[username]/...)

export interface UserParams {
  username: string
}

// For Next.js app router paths
export const userPaths = {
  profile: '/u/[username]',
  settings: '/u/[username]/settings',
  newProject: '/u/[username]/projects/new',
} as const

// For navigation - functions that generate actual URLs
export const userRoutes = {
  profile: (params: UserParams) => `/u/${params.username}`,
  settings: (params: UserParams) => `/u/${params.username}/settings`,
  newProject: (params: UserParams) => `/u/${params.username}/projects/new`,
} as const
