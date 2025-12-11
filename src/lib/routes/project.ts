// Project routes

export interface ProjectParams {
  slug: string
}

// For Next.js app router paths
export const projectPaths = {
  detail: '/p/[slug]',
  settings: '/p/[slug]/settings',
} as const

// For navigation - functions that generate actual URLs
export const projectRoutes = {
  detail: (params: ProjectParams) => `/p/${params.slug}`,
  settings: (params: ProjectParams) => `/p/${params.slug}/settings`,
} as const
