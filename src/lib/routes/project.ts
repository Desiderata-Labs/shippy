// Project routes

export interface ProjectParams {
  slug: string
}

export interface BountyParams extends ProjectParams {
  bountyId: string
}

// For Next.js app router paths
export const projectPaths = {
  detail: '/p/[slug]',
  settings: '/p/[slug]/settings',
  newBounty: '/p/[slug]/bounties/new',
  bountyDetail: '/p/[slug]/bounty/[bountyId]',
} as const

// For navigation - functions that generate actual URLs
export const projectRoutes = {
  detail: (params: ProjectParams) => `/p/${params.slug}`,
  settings: (params: ProjectParams) => `/p/${params.slug}/settings`,
  newBounty: (params: ProjectParams) => `/p/${params.slug}/bounties/new`,
  bountyDetail: (params: BountyParams) =>
    `/p/${params.slug}/bounty/${params.bountyId}`,
} as const
