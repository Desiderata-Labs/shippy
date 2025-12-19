// Project routes
import { slugify } from '@/lib/slugify'

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
  /** Optional bounty title for SEO-friendly URLs */
  title?: string
  /** Optional tab (details or submissions) */
  tab?: 'details' | 'submissions'
  /** Optional submission ID for deep linking in review queue */
  selectedSubmissionId?: string
}

export type BountyEditParams = BountyParams

export interface SubmissionParams extends ProjectParams {
  bountyId: string
  submissionId: string
  /** Optional bounty title for SEO-friendly URLs */
  title?: string
}

export type SubmissionEditParams = SubmissionParams

export type BountySubmitParams = BountyParams

export interface PayoutDetailParams extends ProjectParams {
  payoutId: string
}

/**
 * Create a URL-friendly slug with embedded nanoid
 * e.g., "grow-twitter-audience-TdFKukO9LuJe"
 */
function createIdSlug(id: string, name?: string): string {
  if (!name) return id
  const slug = slugify(name, 40) // Leave room for the nanoid
  return slug ? `${slug}-${id}` : id
}

// For Next.js app router paths
export const projectPaths = {
  detail: '/p/[slug]',
  settings: '/p/[slug]/settings',
  integrations: '/p/[slug]/integrations',
  newBounty: '/p/[slug]/bounties/new',
  suggestBounty: '/p/[slug]/bounties/suggest',
  bountyDetail: '/p/[slug]/bounty/[bountyId]',
  bountyEdit: '/p/[slug]/bounty/[bountyId]/edit',
  bountySubmit: '/p/[slug]/bounty/[bountyId]/submit',
  // submissionDetail now redirects to bounty detail with submissions tab (no separate page)
  submissionEdit: '/p/[slug]/submission/[submissionId]/edit',
  submissions: '/p/[slug]/submissions',
  newPayout: '/p/[slug]/payouts/new',
  payoutDetail: '/p/[slug]/payouts/[payoutId]',
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
  integrations: (params: ProjectParams) => `/p/${params.slug}/integrations`,
  newBounty: (params: ProjectParams) => `/p/${params.slug}/bounties/new`,
  suggestBounty: (params: ProjectParams) =>
    `/p/${params.slug}/bounties/suggest`,
  bountyDetail: (params: BountyParams) => {
    const base = `/p/${params.slug}/bounty/${createIdSlug(params.bountyId, params.title)}`
    const queryParams: string[] = []

    // 'details' is the default tab, so no query param needed
    if (params.tab && params.tab !== 'details') {
      queryParams.push(`tab=${params.tab}`)
    }

    // Add submission ID for deep linking to review queue
    if (params.selectedSubmissionId) {
      queryParams.push(`id=${params.selectedSubmissionId}`)
    }

    return queryParams.length > 0 ? `${base}?${queryParams.join('&')}` : base
  },
  bountyEdit: (params: BountyEditParams) =>
    `/p/${params.slug}/bounty/${createIdSlug(params.bountyId, params.title)}/edit`,
  bountySubmit: (params: BountySubmitParams) =>
    `/p/${params.slug}/bounty/${createIdSlug(params.bountyId, params.title)}/submit`,
  submissionDetail: (params: SubmissionParams) =>
    `/p/${params.slug}/bounty/${createIdSlug(params.bountyId, params.title)}?tab=submissions&id=${params.submissionId}`,
  submissionEdit: (params: SubmissionEditParams) =>
    `/p/${params.slug}/submission/${createIdSlug(params.submissionId, params.title)}/edit`,
  submissions: (params: ProjectParams) => `/p/${params.slug}/submissions`,
  newPayout: (params: ProjectParams) => `/p/${params.slug}/payouts/new`,
  payoutDetail: (params: PayoutDetailParams) =>
    `/p/${params.slug}/payouts/${params.payoutId}`,
} as const
