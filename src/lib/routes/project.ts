// Project routes

export enum ProjectTab {
  BOUNTIES = 'bounties',
  PAYOUTS = 'payouts',
  CONTRIBUTORS = 'contributors',
  README = 'readme',
}

export const DEFAULT_PROJECT_TAB = ProjectTab.BOUNTIES

export interface ProjectParams {
  slug: string
}

export interface ProjectTabParams extends ProjectParams {
  tab?: ProjectTab
}

export interface BountyParams extends ProjectParams {
  bountyId: string
}

export type BountyEditParams = BountyParams

export interface SubmissionParams extends ProjectParams {
  submissionId: string
}

export type SubmissionEditParams = SubmissionParams

export type BountySubmitParams = BountyParams

export interface PayoutParams extends ProjectParams {
  payoutId?: string
}

// For Next.js app router paths
export const projectPaths = {
  detail: '/p/[slug]',
  settings: '/p/[slug]/settings',
  newBounty: '/p/[slug]/bounties/new',
  bountyDetail: '/p/[slug]/bounty/[bountyId]',
  bountyEdit: '/p/[slug]/bounty/[bountyId]/edit',
  bountySubmit: '/p/[slug]/bounty/[bountyId]/submit',
  submissionDetail: '/p/[slug]/submission/[submissionId]',
  submissionEdit: '/p/[slug]/submission/[submissionId]/edit',
  submissions: '/p/[slug]/submissions',
  newPayout: '/p/[slug]/payouts/new',
  payouts: '/p/[slug]/payouts',
} as const

// For navigation - functions that generate actual URLs
export const projectRoutes = {
  detail: (params: ProjectTabParams) => {
    const base = `/p/${params.slug}`
    // BOUNTIES is the default tab, so no query param needed
    if (!params.tab || params.tab === DEFAULT_PROJECT_TAB) return base
    return `${base}?tab=${params.tab}`
  },
  settings: (params: ProjectParams) => `/p/${params.slug}/settings`,
  newBounty: (params: ProjectParams) => `/p/${params.slug}/bounties/new`,
  bountyDetail: (params: BountyParams) =>
    `/p/${params.slug}/bounty/${params.bountyId}`,
  bountyEdit: (params: BountyEditParams) =>
    `/p/${params.slug}/bounty/${params.bountyId}/edit`,
  bountySubmit: (params: BountySubmitParams) =>
    `/p/${params.slug}/bounty/${params.bountyId}/submit`,
  submissionDetail: (params: SubmissionParams) =>
    `/p/${params.slug}/submission/${params.submissionId}`,
  submissionEdit: (params: SubmissionEditParams) =>
    `/p/${params.slug}/submission/${params.submissionId}/edit`,
  submissions: (params: ProjectParams) => `/p/${params.slug}/submissions`,
  newPayout: (params: ProjectParams) => `/p/${params.slug}/payouts/new`,
  payouts: (params: ProjectParams) => `/p/${params.slug}/payouts`,
} as const
