import {
  BountyStatus,
  DEFAULT_PLATFORM_FEE_PERCENTAGE,
  ProfitBasis,
} from '@/lib/db/types'
import { isProjectKeyAvailable } from '@/lib/project-key/server'
import { validateProjectKey } from '@/lib/project-key/shared'
import {
  isProjectSlugAvailable,
  validateProjectSlug,
} from '@/lib/project-slug/server'
import type { Prisma, PrismaClient } from '@prisma/client'

// Type for either PrismaClient or a transaction client
type PrismaClientOrTx = PrismaClient | Prisma.TransactionClient

// ================================
// Create Project Service
// ================================

export interface CreateProjectParams {
  prisma: PrismaClientOrTx
  userId: string
  userEmail?: string // For admin slug validation
  name: string
  slug: string
  projectKey: string
  tagline?: string
  description?: string
  logoUrl?: string
  websiteUrl?: string
  discordUrl?: string
  // Reward pool config
  poolPercentage: number
  payoutFrequency: string
  profitBasis?: string
  commitmentMonths: number
  payoutVisibility?: string
}

export interface CreateProjectResult {
  success: true
  project: {
    id: string
    name: string
    slug: string
    projectKey: string
  }
}

export type CreateProjectError =
  | { success: false; code: 'INVALID_SLUG'; message: string }
  | { success: false; code: 'SLUG_TAKEN'; message: string }
  | { success: false; code: 'INVALID_PROJECT_KEY'; message: string }
  | { success: false; code: 'PROJECT_KEY_TAKEN'; message: string }

/**
 * Create a new project - shared logic used by both tRPC and MCP
 *
 * This handles:
 * - Validating slug format
 * - Checking slug availability
 * - Validating project key format
 * - Checking project key availability (unique per founder)
 * - Creating the project with reward pool
 */
export async function createProject({
  prisma,
  userId,
  userEmail,
  name,
  slug,
  projectKey,
  tagline,
  description,
  logoUrl,
  websiteUrl,
  discordUrl,
  poolPercentage,
  payoutFrequency,
  profitBasis,
  commitmentMonths,
  payoutVisibility,
}: CreateProjectParams): Promise<CreateProjectResult | CreateProjectError> {
  // Validate slug format (admins can use reserved slugs)
  const slugValidation = validateProjectSlug(slug, userEmail)
  if (!slugValidation.isValid) {
    return {
      success: false,
      code: 'INVALID_SLUG',
      message: slugValidation.error || 'Invalid slug',
    }
  }

  // Check if slug is available
  const slugAvailable = await isProjectSlugAvailable(slug, { userEmail })
  if (!slugAvailable) {
    return {
      success: false,
      code: 'SLUG_TAKEN',
      message: 'This slug is already taken',
    }
  }

  // Validate project key
  const keyValidation = validateProjectKey(projectKey)
  if (!keyValidation.isValid) {
    return {
      success: false,
      code: 'INVALID_PROJECT_KEY',
      message: keyValidation.error || 'Invalid project key',
    }
  }

  // Check key availability (unique per founder)
  const keyAvailable = await isProjectKeyAvailable(userId, projectKey)
  if (!keyAvailable) {
    return {
      success: false,
      code: 'PROJECT_KEY_TAKEN',
      message: 'This project key is already used by one of your projects',
    }
  }

  // Calculate commitment end date
  const commitmentEndsAt = new Date()
  commitmentEndsAt.setMonth(commitmentEndsAt.getMonth() + commitmentMonths)

  // Create project with reward pool
  const project = await prisma.project.create({
    data: {
      name,
      slug,
      projectKey,
      tagline,
      description,
      logoUrl,
      websiteUrl,
      discordUrl,
      payoutVisibility,
      founderId: userId,
      rewardPool: {
        create: {
          poolPercentage,
          payoutFrequency,
          profitBasis: profitBasis ?? ProfitBasis.NET_PROFIT,
          commitmentMonths,
          commitmentEndsAt,
          platformFeePercentage: DEFAULT_PLATFORM_FEE_PERCENTAGE,
        },
      },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      projectKey: true,
    },
  })

  return { success: true, project }
}

// ================================
// Update Project Service
// ================================

export interface UpdateProjectParams {
  prisma: PrismaClientOrTx
  projectId: string
  userId: string
  userEmail?: string // For admin slug validation
  data: {
    name?: string
    slug?: string
    projectKey?: string
    tagline?: string
    description?: string
    logoUrl?: string | null
    websiteUrl?: string | null
    discordUrl?: string | null
    // Reward pool config
    poolPercentage?: number
    payoutFrequency?: string
    commitmentMonths?: number
    payoutVisibility?: string
  }
}

export interface UpdateProjectResult {
  success: true
  project: {
    id: string
    name: string
    slug: string
    projectKey: string
  }
}

export type UpdateProjectError =
  | { success: false; code: 'NOT_FOUND'; message: string }
  | { success: false; code: 'FORBIDDEN'; message: string }
  | { success: false; code: 'INVALID_SLUG'; message: string }
  | { success: false; code: 'SLUG_TAKEN'; message: string }
  | { success: false; code: 'INVALID_PROJECT_KEY'; message: string }
  | { success: false; code: 'PROJECT_KEY_TAKEN'; message: string }
  | { success: false; code: 'REWARD_POOL_LOCKED'; message: string }
  | { success: false; code: 'NO_CHANGES'; message: string }

/**
 * Update a project - shared logic used by both tRPC and MCP
 *
 * This handles:
 * - Verifying project exists
 * - Validating ownership (founder check)
 * - Validating slug changes
 * - Validating project key changes
 * - Checking reward pool editability
 * - Updating the project
 */
export async function updateProject({
  prisma,
  projectId,
  userId,
  userEmail,
  data,
}: UpdateProjectParams): Promise<UpdateProjectResult | UpdateProjectError> {
  // Verify ownership
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { founderId: true, slug: true, projectKey: true },
  })

  if (!project) {
    return { success: false, code: 'NOT_FOUND', message: 'Project not found' }
  }

  if (project.founderId !== userId) {
    return {
      success: false,
      code: 'FORBIDDEN',
      message: 'You do not own this project',
    }
  }

  // If slug is being changed, validate it
  if (data.slug && data.slug !== project.slug) {
    const validation = validateProjectSlug(data.slug, userEmail)
    if (!validation.isValid) {
      return {
        success: false,
        code: 'INVALID_SLUG',
        message: validation.error || 'Invalid slug',
      }
    }

    const available = await isProjectSlugAvailable(data.slug, { userEmail })
    if (!available) {
      return {
        success: false,
        code: 'SLUG_TAKEN',
        message: 'This slug is already taken',
      }
    }
  }

  // If project key is being changed, validate and ensure it's unique for this founder
  if (data.projectKey && data.projectKey !== project.projectKey) {
    const keyValidation = validateProjectKey(data.projectKey)
    if (!keyValidation.isValid) {
      return {
        success: false,
        code: 'INVALID_PROJECT_KEY',
        message: keyValidation.error || 'Invalid project key',
      }
    }

    const keyAvailable = await isProjectKeyAvailable(userId, data.projectKey, {
      excludeProjectId: projectId,
    })
    if (!keyAvailable) {
      return {
        success: false,
        code: 'PROJECT_KEY_TAKEN',
        message: 'This project key is already used by one of your projects',
      }
    }
  }

  // Check if trying to update reward pool settings
  const hasRewardPoolUpdates =
    data.poolPercentage !== undefined ||
    data.payoutFrequency !== undefined ||
    data.commitmentMonths !== undefined

  if (hasRewardPoolUpdates) {
    // Check if there are any claimed or completed bounties
    const claimedOrCompletedCount = await prisma.bounty.count({
      where: {
        projectId,
        status: {
          in: [BountyStatus.CLAIMED, BountyStatus.COMPLETED],
        },
      },
    })

    if (claimedOrCompletedCount > 0) {
      return {
        success: false,
        code: 'REWARD_POOL_LOCKED',
        message:
          'Cannot update reward pool settings when bounties have been claimed or completed',
      }
    }
  }

  // Build reward pool update data
  const rewardPoolUpdate: Prisma.RewardPoolUpdateInput = {}

  if (data.poolPercentage !== undefined) {
    rewardPoolUpdate.poolPercentage = data.poolPercentage
  }
  if (data.payoutFrequency !== undefined) {
    rewardPoolUpdate.payoutFrequency = data.payoutFrequency
  }
  if (data.commitmentMonths !== undefined) {
    rewardPoolUpdate.commitmentMonths = data.commitmentMonths
    // Recalculate commitment end date from now
    const commitmentEndsAt = new Date()
    commitmentEndsAt.setMonth(
      commitmentEndsAt.getMonth() + data.commitmentMonths,
    )
    rewardPoolUpdate.commitmentEndsAt = commitmentEndsAt
  }

  // Build project update data
  const projectUpdate: Prisma.ProjectUpdateInput = {}

  if (data.name !== undefined) projectUpdate.name = data.name
  if (data.tagline !== undefined) projectUpdate.tagline = data.tagline
  if (data.description !== undefined)
    projectUpdate.description = data.description
  if (data.logoUrl !== undefined) projectUpdate.logoUrl = data.logoUrl
  if (data.websiteUrl !== undefined) projectUpdate.websiteUrl = data.websiteUrl
  if (data.discordUrl !== undefined) projectUpdate.discordUrl = data.discordUrl
  if (data.payoutVisibility !== undefined)
    projectUpdate.payoutVisibility = data.payoutVisibility
  if (data.slug && data.slug !== project.slug) projectUpdate.slug = data.slug
  if (data.projectKey && data.projectKey !== project.projectKey)
    projectUpdate.projectKey = data.projectKey

  if (Object.keys(rewardPoolUpdate).length > 0) {
    projectUpdate.rewardPool = { update: rewardPoolUpdate }
  }

  // Check if there's anything to update
  if (Object.keys(projectUpdate).length === 0) {
    return {
      success: false,
      code: 'NO_CHANGES',
      message: 'No changes provided',
    }
  }

  const updated = await prisma.project.update({
    where: { id: projectId },
    data: projectUpdate,
    select: {
      id: true,
      name: true,
      slug: true,
      projectKey: true,
    },
  })

  return { success: true, project: updated }
}

// ================================
// Update Project Logo Service
// ================================

export interface UpdateProjectLogoParams {
  prisma: PrismaClientOrTx
  projectId: string
  userId: string
  logoUrl: string | null
}

export interface UpdateProjectLogoResult {
  success: true
  project: { id: string; logoUrl: string | null }
}

export type UpdateProjectLogoError =
  | { success: false; code: 'NOT_FOUND'; message: string }
  | { success: false; code: 'FORBIDDEN'; message: string }

/**
 * Update project logo - shared logic used by both tRPC and MCP
 */
export async function updateProjectLogo({
  prisma,
  projectId,
  userId,
  logoUrl,
}: UpdateProjectLogoParams): Promise<
  UpdateProjectLogoResult | UpdateProjectLogoError
> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { founderId: true },
  })

  if (!project) {
    return { success: false, code: 'NOT_FOUND', message: 'Project not found' }
  }

  if (project.founderId !== userId) {
    return {
      success: false,
      code: 'FORBIDDEN',
      message: 'You do not own this project',
    }
  }

  const updated = await prisma.project.update({
    where: { id: projectId },
    data: { logoUrl },
    select: { id: true, logoUrl: true },
  })

  return { success: true, project: updated }
}
