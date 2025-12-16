import { prisma as globalPrisma } from '@/lib/db/server'
import {
  BountyClaimMode,
  BountyStatus,
  ClaimStatus,
  NotificationReferenceType,
  NotificationType,
  SubmissionEventType,
  SubmissionStatus,
} from '@/lib/db/types'
import { createNotifications } from '@/server/routers/notification'
import type { Prisma, PrismaClient } from '@prisma/client'

// Type for either PrismaClient or a transaction client
type PrismaClientOrTx = PrismaClient | Prisma.TransactionClient

// ================================
// Claim Bounty Service
// ================================

export interface ClaimBountyParams {
  prisma: PrismaClientOrTx
  bountyId: string
  userId: string
}

export interface ClaimBountyResult {
  success: true
  claim: { id: string; expiresAt: Date }
}

export type ClaimBountyError =
  | { success: false; code: 'NOT_FOUND'; message: string }
  | { success: false; code: 'BACKLOG'; message: string }
  | { success: false; code: 'COMPLETED'; message: string }
  | { success: false; code: 'CLOSED'; message: string }
  | { success: false; code: 'ALREADY_CLAIMED_SINGLE'; message: string }
  | { success: false; code: 'ALREADY_CLAIMED_BY_USER'; message: string }
  | { success: false; code: 'MAX_CLAIMS_REACHED'; message: string }

/**
 * Claim a bounty - shared logic used by both tRPC and webhooks
 *
 * This handles:
 * - Validating bounty status (BACKLOG, COMPLETED, CLOSED checks)
 * - Checking claim mode (SINGLE vs MULTIPLE)
 * - Checking for existing active claim by user
 * - Checking maxClaims limit
 * - Creating claim with expiry date
 * - Updating bounty status to CLAIMED (only if OPEN)
 * - Creating notification for founder
 */
export async function claimBounty({
  prisma,
  bountyId,
  userId,
}: ClaimBountyParams): Promise<ClaimBountyResult | ClaimBountyError> {
  const bounty = await prisma.bounty.findUnique({
    where: { id: bountyId },
    include: {
      project: { select: { founderId: true } },
      claims: { where: { status: ClaimStatus.ACTIVE } },
    },
  })

  if (!bounty) {
    return { success: false, code: 'NOT_FOUND', message: 'Bounty not found' }
  }

  // Validate bounty status
  if (bounty.status === BountyStatus.BACKLOG) {
    return {
      success: false,
      code: 'BACKLOG',
      message: 'This bounty is in the backlog and cannot be claimed yet',
    }
  }

  if (bounty.status === BountyStatus.COMPLETED) {
    return {
      success: false,
      code: 'COMPLETED',
      message: 'This bounty has already been completed',
    }
  }

  if (bounty.status === BountyStatus.CLOSED) {
    return { success: false, code: 'CLOSED', message: 'This bounty is closed' }
  }

  // For CLAIMED bounties, only allow if in MULTIPLE mode (competitive)
  if (
    bounty.status === BountyStatus.CLAIMED &&
    bounty.claimMode !== BountyClaimMode.MULTIPLE
  ) {
    return {
      success: false,
      code: 'ALREADY_CLAIMED_SINGLE',
      message: 'This bounty has already been claimed',
    }
  }

  // Check existing active claim by this user
  const existingActiveClaim = await prisma.bountyClaim.findFirst({
    where: {
      bountyId,
      userId,
      status: ClaimStatus.ACTIVE,
    },
  })

  if (existingActiveClaim) {
    return {
      success: false,
      code: 'ALREADY_CLAIMED_BY_USER',
      message: 'You have already claimed this bounty',
    }
  }

  // For SINGLE mode, check if already claimed
  if (bounty.claimMode === BountyClaimMode.SINGLE && bounty.claims.length > 0) {
    return {
      success: false,
      code: 'ALREADY_CLAIMED_SINGLE',
      message: 'This bounty has already been claimed',
    }
  }

  // For MULTIPLE mode with maxClaims, check limit
  if (bounty.maxClaims && bounty.claims.length >= bounty.maxClaims) {
    return {
      success: false,
      code: 'MAX_CLAIMS_REACHED',
      message: 'This bounty has reached its maximum number of claims',
    }
  }

  // Calculate expiry date
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + bounty.claimExpiryDays)

  // Create new claim
  const claim = await prisma.bountyClaim.create({
    data: {
      bountyId,
      userId,
      expiresAt,
    },
  })

  // Update bounty status to CLAIMED if this is the first claim
  if (bounty.status === BountyStatus.OPEN) {
    await prisma.bounty.update({
      where: { id: bountyId },
      data: { status: BountyStatus.CLAIMED },
    })
  }

  // Notify founder about the claim (fire and forget, uses global prisma)
  createNotifications({
    prisma: globalPrisma,
    type: NotificationType.BOUNTY_CLAIMED,
    referenceType: NotificationReferenceType.BOUNTY,
    referenceId: bountyId,
    actorId: userId,
    recipientIds: [bounty.project.founderId],
  }).catch((err) => {
    console.error('Failed to create claim notification:', err)
  })

  return { success: true, claim: { id: claim.id, expiresAt: claim.expiresAt } }
}

// ================================
// Release Claim Service
// ================================

export interface ReleaseClaimParams {
  prisma: PrismaClientOrTx
  claimId: string
  userId: string // User attempting to release (for auth check)
  reason?: string
  /** If true, skip ownership check (for system/webhook use) */
  skipAuthCheck?: boolean
}

export interface ReleaseClaimResult {
  success: true
}

export type ReleaseClaimError =
  | { success: false; code: 'NOT_FOUND'; message: string }
  | { success: false; code: 'FORBIDDEN'; message: string }

/**
 * Release a claim - shared logic used by both tRPC and webhooks
 *
 * This handles:
 * - Validating ownership (claimant or founder can release)
 * - Updating claim status to RELEASED
 * - Withdrawing any pending submissions
 * - Creating submission events for withdrawals
 * - Reopening bounty if SINGLE mode and no remaining claims
 */
export async function releaseClaim({
  prisma,
  claimId,
  userId,
  reason,
  skipAuthCheck = false,
}: ReleaseClaimParams): Promise<ReleaseClaimResult | ReleaseClaimError> {
  const claim = await prisma.bountyClaim.findUnique({
    where: { id: claimId },
    include: {
      bounty: {
        include: { project: { select: { founderId: true } } },
      },
    },
  })

  if (!claim) {
    return { success: false, code: 'NOT_FOUND', message: 'Claim not found' }
  }

  // Authorization check (unless skipped)
  if (!skipAuthCheck) {
    const isClaimant = claim.userId === userId
    const isFounder = claim.bounty.project.founderId === userId

    if (!isClaimant && !isFounder) {
      return {
        success: false,
        code: 'FORBIDDEN',
        message: 'You cannot release this claim',
      }
    }
  }

  // Update claim status
  await prisma.bountyClaim.update({
    where: { id: claimId },
    data: { status: ClaimStatus.RELEASED },
  })

  // Find and withdraw any pending submissions from this user for this bounty
  const submissionsToWithdraw = await prisma.submission.findMany({
    where: {
      bountyId: claim.bountyId,
      userId: claim.userId,
      status: {
        in: [
          SubmissionStatus.DRAFT,
          SubmissionStatus.PENDING,
          SubmissionStatus.NEEDS_INFO,
        ],
      },
    },
    select: { id: true, status: true },
  })

  // Update submissions and create withdrawal events
  for (const submission of submissionsToWithdraw) {
    await prisma.submission.update({
      where: { id: submission.id },
      data: { status: SubmissionStatus.WITHDRAWN },
    })

    await prisma.submissionEvent.create({
      data: {
        submissionId: submission.id,
        userId: claim.userId,
        type: SubmissionEventType.STATUS_CHANGE,
        fromStatus: submission.status,
        toStatus: SubmissionStatus.WITHDRAWN,
        note: reason || null,
      },
    })
  }

  // If SINGLE mode and bounty is still CLAIMED (not COMPLETED/CLOSED), check if we should reopen
  if (
    claim.bounty.claimMode === BountyClaimMode.SINGLE &&
    claim.bounty.status === BountyStatus.CLAIMED
  ) {
    const remainingClaims = await prisma.bountyClaim.count({
      where: {
        bountyId: claim.bountyId,
        status: { in: [ClaimStatus.ACTIVE, ClaimStatus.SUBMITTED] },
      },
    })

    if (remainingClaims === 0) {
      await prisma.bounty.update({
        where: { id: claim.bountyId },
        data: { status: BountyStatus.OPEN },
      })
    }
  }

  return { success: true }
}

// ================================
// Create Bounty Service
// ================================

export interface CreateBountyParams {
  prisma: PrismaClientOrTx
  projectId: string
  title: string
  description: string
  points: number | null
  /** GitHub issue link data (optional) */
  githubIssueLink?: {
    repoId: number
    issueNumber: number
    issueNodeId: string
  }
}

export interface CreateBountyResult {
  success: true
  bounty: {
    id: string
    number: number
    status: string
  }
}

export type CreateBountyError =
  | { success: false; code: 'NOT_FOUND'; message: string }
  | { success: false; code: 'NO_REWARD_POOL'; message: string }

/**
 * Create a bounty - shared logic used by both tRPC and webhooks
 *
 * This handles:
 * - Validating project exists
 * - Validating reward pool exists
 * - Reserving bounty number atomically
 * - Setting status based on points (BACKLOG vs OPEN)
 * - Creating the bounty with optional GitHub issue link
 *
 * Note: Caller is responsible for authorization (founder check)
 * Note: Labels are handled separately by tRPC if needed
 */
export async function createBounty({
  prisma,
  projectId,
  title,
  description,
  points,
  githubIssueLink,
}: CreateBountyParams): Promise<CreateBountyResult | CreateBountyError> {
  // Verify project exists and has a reward pool
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { rewardPool: true },
  })

  if (!project) {
    return { success: false, code: 'NOT_FOUND', message: 'Project not found' }
  }

  if (!project.rewardPool) {
    return {
      success: false,
      code: 'NO_REWARD_POOL',
      message: 'Project does not have a reward pool',
    }
  }

  // If no points provided, this is a backlog bounty
  const status = points === null ? BountyStatus.BACKLOG : BountyStatus.OPEN

  // Reserve number + create bounty atomically
  // Note: If prisma is already a transaction, this will use it
  // Otherwise, we need to handle the number reservation carefully
  const updatedProject = await prisma.project.update({
    where: { id: projectId },
    data: { nextBountyNumber: { increment: 1 } },
    select: { nextBountyNumber: true },
  })
  const bountyNumber = updatedProject.nextBountyNumber - 1

  const bounty = await prisma.bounty.create({
    data: {
      projectId,
      number: bountyNumber,
      title,
      description,
      points,
      status,
      ...(githubIssueLink && {
        githubIssueLink: {
          create: {
            repoId: githubIssueLink.repoId,
            issueNumber: githubIssueLink.issueNumber,
            issueNodeId: githubIssueLink.issueNodeId,
          },
        },
      }),
    },
  })

  return {
    success: true,
    bounty: {
      id: bounty.id,
      number: bounty.number,
      status: bounty.status,
    },
  }
}
