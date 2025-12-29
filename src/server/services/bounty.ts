import {
  allowsMultipleClaims,
  shouldReopenOnClaimRelease,
} from '@/lib/bounty/claim-modes'
import { prisma as globalPrisma } from '@/lib/db/server'
import {
  AttachmentReferenceType,
  BountyClaimMode,
  BountyEventType,
  BountyStatus,
  ClaimStatus,
  NotificationReferenceType,
  NotificationType,
  SubmissionEventType,
  SubmissionStatus,
} from '@/lib/db/types'
import { createNotifications } from '@/server/routers/notification'
import { checkAgreement } from '@/server/services/contributor-agreement'
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
  | {
      success: false
      code: 'AGREEMENT_REQUIRED'
      message: string
      projectId: string
    }
  | {
      success: false
      code: 'AGREEMENT_NOT_CONFIGURED'
      message: string
    }

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
      project: {
        select: {
          id: true,
          founderId: true,
          contributorTermsEnabled: true,
          projectOwnerLegalName: true,
          projectOwnerContactEmail: true,
        },
      },
      claims: { where: { status: ClaimStatus.ACTIVE } },
    },
  })

  if (!bounty) {
    return { success: false, code: 'NOT_FOUND', message: 'Bounty not found' }
  }

  // Skip agreement checks for founders (they don't need to accept their own terms)
  if (bounty.project.founderId !== userId) {
    // Check if agreement is properly configured by the project owner
    const isAgreementConfigured =
      bounty.project.contributorTermsEnabled &&
      bounty.project.projectOwnerLegalName?.trim() &&
      bounty.project.projectOwnerContactEmail?.trim()

    if (!isAgreementConfigured) {
      return {
        success: false,
        code: 'AGREEMENT_NOT_CONFIGURED',
        message:
          'The project owner has not configured the contributor agreement. Please contact the project owner.',
      }
    }

    // Check if user has accepted the agreement
    const agreementCheck = await checkAgreement(
      prisma,
      bounty.projectId,
      userId,
    )
    if (agreementCheck.requiresAcceptance) {
      return {
        success: false,
        code: 'AGREEMENT_REQUIRED',
        message:
          'You must accept the contributor agreement before claiming this bounty',
        projectId: bounty.projectId,
      }
    }
  }

  // Validate bounty status
  if (bounty.status === BountyStatus.SUGGESTED) {
    return {
      success: false,
      code: 'BACKLOG', // Reuse BACKLOG code - both mean "not claimable"
      message: 'This bounty is pending approval and cannot be claimed yet',
    }
  }

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

  // Check existing active claim by this user FIRST
  // This is important for the GitHub webhook: if the user already claimed
  // the bounty on the web and opens a PR, we return ALREADY_CLAIMED_BY_USER
  // which the webhook treats as "proceed to create submission"
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

  // For CLAIMED bounties, only allow additional claims if mode allows it
  // This check comes AFTER the user's own claim check
  if (
    bounty.status === BountyStatus.CLAIMED &&
    !allowsMultipleClaims(bounty.claimMode as BountyClaimMode)
  ) {
    return {
      success: false,
      code: 'ALREADY_CLAIMED_SINGLE',
      message: 'This bounty has already been claimed',
    }
  }

  // For SINGLE mode, check if already claimed (belt-and-suspenders with status check above)
  if (bounty.claimMode === BountyClaimMode.SINGLE && bounty.claims.length > 0) {
    return {
      success: false,
      code: 'ALREADY_CLAIMED_SINGLE',
      message: 'This bounty has already been claimed',
    }
  }

  // For modes with maxClaims, check limit
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

  // Check if we should reopen the bounty (only for exclusive modes)
  if (
    shouldReopenOnClaimRelease(claim.bounty.claimMode as BountyClaimMode) &&
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
  userId: string // User attempting to create (for auth check)
  /** Optional pre-generated ID (for associating attachments uploaded before creation) */
  id?: string
  title: string
  description: string
  points: number | null
  /** Optional label IDs to attach */
  labelIds?: string[]
  /** Claim mode: SINGLE | COMPETITIVE | MULTIPLE | PERFORMANCE */
  claimMode?: BountyClaimMode
  /** Days before a claim expires if no submission */
  claimExpiryDays?: number
  /** Maximum number of claims allowed (for COMPETITIVE/MULTIPLE/PERFORMANCE modes) */
  maxClaims?: number | null
  /** Description of evidence required for submission */
  evidenceDescription?: string
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
    title: string
    description: string
    points: number | null
    claimMode: string
    claimExpiryDays: number
    maxClaims: number | null
    evidenceDescription: string | null
  }
}

export type CreateBountyError =
  | { success: false; code: 'NOT_FOUND'; message: string }
  | { success: false; code: 'FORBIDDEN'; message: string }
  | { success: false; code: 'NO_REWARD_POOL'; message: string }

/**
 * Create a bounty - shared logic used by tRPC, MCP, and webhooks
 *
 * This handles:
 * - Validating project exists
 * - Validating ownership (founder check)
 * - Validating reward pool exists
 * - Reserving bounty number atomically
 * - Setting status based on points (BACKLOG vs OPEN)
 * - Creating the bounty with all options
 * - Creating label associations
 */
export async function createBounty({
  prisma,
  projectId,
  userId,
  id,
  title,
  description,
  points,
  labelIds = [],
  claimMode = BountyClaimMode.SINGLE,
  claimExpiryDays = 14,
  maxClaims,
  evidenceDescription,
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

  // Authorization: only founder can create bounties
  if (project.founderId !== userId) {
    return {
      success: false,
      code: 'FORBIDDEN',
      message: 'You do not own this project',
    }
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
  const updatedProject = await prisma.project.update({
    where: { id: projectId },
    data: { nextBountyNumber: { increment: 1 } },
    select: { nextBountyNumber: true },
  })
  const bountyNumber = updatedProject.nextBountyNumber - 1

  const bounty = await prisma.bounty.create({
    data: {
      ...(id && { id }), // Use pre-generated ID if provided
      projectId,
      number: bountyNumber,
      title,
      description,
      points,
      status,
      claimMode,
      claimExpiryDays,
      maxClaims,
      evidenceDescription,
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

  // Associate any pending attachments with this bounty
  if (id) {
    await prisma.attachment.updateMany({
      where: {
        referenceType: AttachmentReferenceType.PENDING_BOUNTY,
        referenceId: id,
        userId, // Only associate attachments uploaded by this user
      },
      data: {
        referenceType: AttachmentReferenceType.BOUNTY,
      },
    })
  }

  // Add labels if provided
  if (labelIds.length > 0) {
    await prisma.bountyLabel.createMany({
      data: labelIds.map((labelId) => ({
        bountyId: bounty.id,
        labelId,
      })),
    })
  }

  return {
    success: true,
    bounty: {
      id: bounty.id,
      number: bounty.number,
      status: bounty.status,
      title: bounty.title,
      description: bounty.description,
      points: bounty.points,
      claimMode: bounty.claimMode,
      claimExpiryDays: bounty.claimExpiryDays,
      maxClaims: bounty.maxClaims,
      evidenceDescription: bounty.evidenceDescription,
    },
  }
}

// ================================
// Update Bounty Service
// ================================

export interface UpdateBountyParams {
  prisma: PrismaClientOrTx
  bountyId: string
  userId: string // User attempting to update (for auth check)
  data: {
    title?: string
    description?: string
    evidenceDescription?: string | null
    points?: number | null
    status?: BountyStatus
    claimMode?: BountyClaimMode
    claimExpiryDays?: number
    maxClaims?: number | null
    labelIds?: string[]
  }
}

export interface UpdateBountyResult {
  success: true
  bounty: {
    id: string
    title: string
    description: string
    evidenceDescription: string | null
    points: number | null
    status: string
    claimMode: string
    claimExpiryDays: number
    maxClaims: number | null
  }
  changes: Record<string, { from: unknown; to: unknown }>
}

export type UpdateBountyError =
  | { success: false; code: 'NOT_FOUND'; message: string }
  | { success: false; code: 'FORBIDDEN'; message: string }
  | { success: false; code: 'NO_CHANGES'; message: string }
  | { success: false; code: 'INVALID_POINTS_CHANGE'; message: string }

/**
 * Update a bounty - shared logic used by both tRPC and MCP
 *
 * This handles:
 * - Verifying bounty exists
 * - Validating ownership (founder check)
 * - Validating points changes (can't change on completed/closed, can't remove on claimed)
 * - Automatic status transitions (BACKLOG <-> OPEN based on points)
 * - Building audit trail of changes
 * - Updating the bounty and labels
 * - Creating edit/status change events
 */
export async function updateBounty({
  prisma,
  bountyId,
  userId,
  data,
}: UpdateBountyParams): Promise<UpdateBountyResult | UpdateBountyError> {
  // Fetch bounty with project and labels to check ownership
  const bounty = await prisma.bounty.findUnique({
    where: { id: bountyId },
    include: {
      project: { select: { founderId: true } },
      labels: { select: { labelId: true } },
    },
  })

  if (!bounty) {
    return { success: false, code: 'NOT_FOUND', message: 'Bounty not found' }
  }

  const isFounder = bounty.project.founderId === userId
  const isSuggester =
    bounty.status === BountyStatus.SUGGESTED && bounty.suggestedById === userId

  // Authorization: founder can update any bounty, suggester can update their own suggestion
  if (!isFounder && !isSuggester) {
    return {
      success: false,
      code: 'FORBIDDEN',
      message: 'You do not have permission to update this bounty',
    }
  }

  // Suggesters can only update content fields, not status/points/labels/claim settings
  if (isSuggester && !isFounder) {
    const restrictedFields = [
      'points',
      'status',
      'labelIds',
      'claimMode',
      'claimExpiryDays',
      'maxClaims',
    ] as const
    for (const field of restrictedFields) {
      if (data[field] !== undefined) {
        return {
          success: false,
          code: 'FORBIDDEN',
          message: `Only the project founder can update ${field} on a bounty`,
        }
      }
    }
  }

  // Build a record of what changed for the audit trail
  const changes: Record<string, { from: unknown; to: unknown }> = {}

  // Track field changes
  if (data.title !== undefined && data.title !== bounty.title) {
    changes.title = { from: bounty.title, to: data.title }
  }

  if (
    data.description !== undefined &&
    data.description !== bounty.description
  ) {
    changes.description = { from: bounty.description, to: data.description }
  }

  if (
    data.evidenceDescription !== undefined &&
    data.evidenceDescription !== bounty.evidenceDescription
  ) {
    changes.evidenceDescription = {
      from: bounty.evidenceDescription,
      to: data.evidenceDescription,
    }
  }

  if (data.points !== undefined && data.points !== bounty.points) {
    changes.points = { from: bounty.points, to: data.points }
  }

  if (data.labelIds !== undefined) {
    const oldLabelIds = bounty.labels.map((l) => l.labelId).sort()
    const newLabelIds = [...data.labelIds].sort()
    if (oldLabelIds.join(',') !== newLabelIds.join(',')) {
      changes.labels = { from: oldLabelIds, to: newLabelIds }
    }
  }

  if (data.status !== undefined && data.status !== bounty.status) {
    changes.status = { from: bounty.status, to: data.status }
  }

  if (data.claimMode !== undefined && data.claimMode !== bounty.claimMode) {
    changes.claimMode = { from: bounty.claimMode, to: data.claimMode }
  }

  if (
    data.claimExpiryDays !== undefined &&
    data.claimExpiryDays !== bounty.claimExpiryDays
  ) {
    changes.claimExpiryDays = {
      from: bounty.claimExpiryDays,
      to: data.claimExpiryDays,
    }
  }

  if (data.maxClaims !== undefined && data.maxClaims !== bounty.maxClaims) {
    changes.maxClaims = { from: bounty.maxClaims, to: data.maxClaims }
  }

  // Validate points changes
  if (data.points !== undefined && data.points !== bounty.points) {
    if (
      bounty.status === BountyStatus.COMPLETED ||
      bounty.status === BountyStatus.CLOSED
    ) {
      return {
        success: false,
        code: 'INVALID_POINTS_CHANGE',
        message: 'Cannot change points on a completed or closed bounty',
      }
    }

    // Prevent removing points (backlog) on claimed bounties
    if (bounty.status === BountyStatus.CLAIMED && data.points === null) {
      return {
        success: false,
        code: 'INVALID_POINTS_CHANGE',
        message: 'Cannot remove points from a bounty that is being worked on',
      }
    }
  }

  // Handle automatic status transitions based on points changes
  // - BACKLOG -> OPEN: when points are assigned
  // - OPEN -> BACKLOG: when points are removed (only if no claims/submissions)
  let finalStatus = data.status
  if (data.points !== undefined && data.points !== bounty.points) {
    const wasBacklog = bounty.status === BountyStatus.BACKLOG
    const wasOpen = bounty.status === BountyStatus.OPEN
    const nowHasPoints = data.points !== null
    const nowNoPoints = data.points === null

    if (wasBacklog && nowHasPoints && !data.status) {
      // Auto-transition from BACKLOG to OPEN when points are assigned
      finalStatus = BountyStatus.OPEN
      changes.status = { from: BountyStatus.BACKLOG, to: BountyStatus.OPEN }
    } else if (wasOpen && nowNoPoints && !data.status) {
      // Auto-transition from OPEN to BACKLOG when points are removed
      finalStatus = BountyStatus.BACKLOG
      changes.status = { from: BountyStatus.OPEN, to: BountyStatus.BACKLOG }
    }
  }

  // If nothing changed, return early
  if (Object.keys(changes).length === 0) {
    return {
      success: false,
      code: 'NO_CHANGES',
      message: 'No changes detected',
    }
  }

  // Build the update data object
  const updateData: Prisma.BountyUpdateInput = {}
  if (data.title !== undefined) updateData.title = data.title
  if (data.description !== undefined) updateData.description = data.description
  if (data.evidenceDescription !== undefined)
    updateData.evidenceDescription = data.evidenceDescription
  if (data.points !== undefined) updateData.points = data.points
  if (finalStatus !== undefined) updateData.status = finalStatus
  if (data.claimMode !== undefined) updateData.claimMode = data.claimMode
  if (data.claimExpiryDays !== undefined)
    updateData.claimExpiryDays = data.claimExpiryDays
  if (data.maxClaims !== undefined) updateData.maxClaims = data.maxClaims

  // Update the bounty
  const updated = await prisma.bounty.update({
    where: { id: bountyId },
    data: updateData,
  })

  // Update labels if provided
  if (data.labelIds !== undefined && changes.labels) {
    // Delete all existing labels
    await prisma.bountyLabel.deleteMany({
      where: { bountyId },
    })
    // Create new labels
    if (data.labelIds.length > 0) {
      await prisma.bountyLabel.createMany({
        data: data.labelIds.map((labelId) => ({
          bountyId,
          labelId,
        })),
      })
    }
  }

  // Create events for audit trail
  if (changes.status) {
    // Create STATUS_CHANGE event
    await prisma.bountyEvent.create({
      data: {
        bountyId,
        userId,
        type: BountyEventType.STATUS_CHANGE,
        fromStatus: changes.status.from as string,
        toStatus: changes.status.to as string,
      },
    })

    // If there are other changes besides status, also record an edit
    const nonStatusChanges = { ...changes }
    delete nonStatusChanges.status
    if (Object.keys(nonStatusChanges).length > 0) {
      await prisma.bountyEvent.create({
        data: {
          bountyId,
          userId,
          type: BountyEventType.EDIT,
          changes: nonStatusChanges as Prisma.InputJsonValue,
        },
      })
    }
  } else {
    // Just an edit event
    await prisma.bountyEvent.create({
      data: {
        bountyId,
        userId,
        type: BountyEventType.EDIT,
        changes: changes as Prisma.InputJsonValue,
      },
    })
  }

  return {
    success: true,
    bounty: {
      id: updated.id,
      title: updated.title,
      description: updated.description,
      evidenceDescription: updated.evidenceDescription,
      points: updated.points,
      status: updated.status,
      claimMode: updated.claimMode,
      claimExpiryDays: updated.claimExpiryDays,
      maxClaims: updated.maxClaims,
    },
    changes,
  }
}

// ================================
// Close Bounty Service
// ================================

export interface CloseBountyParams {
  prisma: PrismaClientOrTx
  bountyId: string
  userId: string // User attempting to close (for auth check)
  reason?: string
}

export interface CloseBountyResult {
  success: true
  bounty: { id: string; status: string }
}

export type CloseBountyError =
  | { success: false; code: 'NOT_FOUND'; message: string }
  | { success: false; code: 'FORBIDDEN'; message: string }
  | { success: false; code: 'ALREADY_COMPLETED'; message: string }
  | { success: false; code: 'ALREADY_CLOSED'; message: string }

/**
 * Close a bounty - shared logic used by both tRPC and MCP
 *
 * This handles:
 * - Validating bounty exists
 * - Validating ownership (founder check)
 * - Checking bounty can be closed (not completed/closed)
 * - Expiring all active claims
 * - Withdrawing all pending submissions
 * - Updating bounty status to CLOSED
 * - Creating status change event
 */
export async function closeBounty({
  prisma,
  bountyId,
  userId,
  reason,
}: CloseBountyParams): Promise<CloseBountyResult | CloseBountyError> {
  const bounty = await prisma.bounty.findUnique({
    where: { id: bountyId },
    include: {
      project: { select: { founderId: true } },
      claims: {
        where: {
          status: { in: [ClaimStatus.ACTIVE, ClaimStatus.SUBMITTED] },
        },
        select: { id: true, userId: true, status: true },
      },
      submissions: {
        where: {
          status: {
            in: [
              SubmissionStatus.DRAFT,
              SubmissionStatus.PENDING,
              SubmissionStatus.NEEDS_INFO,
            ],
          },
        },
        select: { id: true, status: true, userId: true },
      },
    },
  })

  if (!bounty) {
    return { success: false, code: 'NOT_FOUND', message: 'Bounty not found' }
  }

  if (bounty.project.founderId !== userId) {
    return {
      success: false,
      code: 'FORBIDDEN',
      message: 'You do not own this project',
    }
  }

  // Cannot close completed bounties (points already awarded)
  if (bounty.status === BountyStatus.COMPLETED) {
    return {
      success: false,
      code: 'ALREADY_COMPLETED',
      message: 'Cannot close a completed bounty - points have been awarded',
    }
  }

  // Already closed
  if (bounty.status === BountyStatus.CLOSED) {
    return {
      success: false,
      code: 'ALREADY_CLOSED',
      message: 'Bounty is already closed',
    }
  }

  const previousStatus = bounty.status

  // Expire all active claims
  if (bounty.claims.length > 0) {
    await prisma.bountyClaim.updateMany({
      where: {
        bountyId,
        status: { in: [ClaimStatus.ACTIVE, ClaimStatus.SUBMITTED] },
      },
      data: { status: ClaimStatus.EXPIRED },
    })
  }

  // Withdraw all pending submissions
  for (const submission of bounty.submissions) {
    await prisma.submission.update({
      where: { id: submission.id },
      data: { status: SubmissionStatus.WITHDRAWN },
    })

    await prisma.submissionEvent.create({
      data: {
        submissionId: submission.id,
        userId,
        type: SubmissionEventType.STATUS_CHANGE,
        fromStatus: submission.status,
        toStatus: SubmissionStatus.WITHDRAWN,
        note: reason ? `Bounty closed: ${reason}` : 'Bounty closed by founder',
      },
    })
  }

  // Update bounty status
  const updated = await prisma.bounty.update({
    where: { id: bountyId },
    data: { status: BountyStatus.CLOSED },
  })

  // Create status change event
  await prisma.bountyEvent.create({
    data: {
      bountyId,
      userId,
      type: BountyEventType.STATUS_CHANGE,
      fromStatus: previousStatus,
      toStatus: BountyStatus.CLOSED,
      content: reason || null,
    },
  })

  return {
    success: true,
    bounty: { id: updated.id, status: updated.status },
  }
}

// ================================
// Reopen Bounty Service
// ================================

export interface ReopenBountyParams {
  prisma: PrismaClientOrTx
  bountyId: string
  userId: string // User attempting to reopen (for auth check)
}

export interface ReopenBountyResult {
  success: true
  bounty: { id: string; status: string }
}

export type ReopenBountyError =
  | { success: false; code: 'NOT_FOUND'; message: string }
  | { success: false; code: 'FORBIDDEN'; message: string }
  | { success: false; code: 'NOT_CLOSED'; message: string }

/**
 * Reopen a closed bounty - shared logic used by both tRPC and MCP
 *
 * This handles:
 * - Validating bounty exists
 * - Validating ownership (founder check)
 * - Checking bounty is closed
 * - Determining new status based on points (BACKLOG if null, OPEN otherwise)
 * - Updating bounty status
 * - Creating status change event
 */
export async function reopenBounty({
  prisma,
  bountyId,
  userId,
}: ReopenBountyParams): Promise<ReopenBountyResult | ReopenBountyError> {
  const bounty = await prisma.bounty.findUnique({
    where: { id: bountyId },
    include: {
      project: { select: { founderId: true } },
    },
  })

  if (!bounty) {
    return { success: false, code: 'NOT_FOUND', message: 'Bounty not found' }
  }

  if (bounty.project.founderId !== userId) {
    return {
      success: false,
      code: 'FORBIDDEN',
      message: 'You do not own this project',
    }
  }

  // Can only reopen closed bounties
  if (bounty.status !== BountyStatus.CLOSED) {
    return {
      success: false,
      code: 'NOT_CLOSED',
      message: 'Only closed bounties can be reopened',
    }
  }

  // Determine new status based on points
  const newStatus =
    bounty.points === null ? BountyStatus.BACKLOG : BountyStatus.OPEN

  const updated = await prisma.bounty.update({
    where: { id: bountyId },
    data: { status: newStatus },
  })

  // Create status change event
  await prisma.bountyEvent.create({
    data: {
      bountyId,
      userId,
      type: BountyEventType.STATUS_CHANGE,
      fromStatus: BountyStatus.CLOSED,
      toStatus: newStatus,
    },
  })

  return {
    success: true,
    bounty: { id: updated.id, status: updated.status },
  }
}

// ================================
// Suggest Bounty Service
// ================================

export interface SuggestBountyParams {
  prisma: PrismaClientOrTx
  projectId: string
  userId: string // Contributor suggesting the bounty
  /** Optional pre-generated ID (for associating attachments uploaded before creation) */
  id?: string
  title: string
  description: string
  /** Description of evidence required for submission */
  evidenceDescription?: string
}

export interface SuggestBountyResult {
  success: true
  bounty: {
    id: string
    number: number
    status: string
    title: string
    description: string
  }
}

export type SuggestBountyError =
  | { success: false; code: 'NOT_FOUND'; message: string }
  | { success: false; code: 'FOUNDER_CANNOT_SUGGEST'; message: string }
  | { success: false; code: 'NO_REWARD_POOL'; message: string }

/**
 * Suggest a bounty - allows contributors to suggest new bounties for founder review
 *
 * This handles:
 * - Validating project exists
 * - Checking user is not the founder (founders should use createBounty)
 * - Validating reward pool exists
 * - Reserving bounty number atomically
 * - Creating bounty with SUGGESTED status (no points, not claimable)
 * - Notifying founder
 */
export async function suggestBounty({
  prisma,
  projectId,
  userId,
  id,
  title,
  description,
  evidenceDescription,
}: SuggestBountyParams): Promise<SuggestBountyResult | SuggestBountyError> {
  // Verify project exists and has a reward pool
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { rewardPool: true },
  })

  if (!project) {
    return { success: false, code: 'NOT_FOUND', message: 'Project not found' }
  }

  // Founders should use createBounty, not suggest
  if (project.founderId === userId) {
    return {
      success: false,
      code: 'FOUNDER_CANNOT_SUGGEST',
      message:
        'As the project founder, you should create bounties directly instead of suggesting them',
    }
  }

  if (!project.rewardPool) {
    return {
      success: false,
      code: 'NO_REWARD_POOL',
      message: 'Project does not have a reward pool',
    }
  }

  // Reserve number + create bounty atomically
  const updatedProject = await prisma.project.update({
    where: { id: projectId },
    data: { nextBountyNumber: { increment: 1 } },
    select: { nextBountyNumber: true },
  })
  const bountyNumber = updatedProject.nextBountyNumber - 1

  const bounty = await prisma.bounty.create({
    data: {
      ...(id && { id }), // Use pre-generated ID if provided
      projectId,
      number: bountyNumber,
      title,
      description,
      points: null, // Suggested bounties have no points initially
      status: BountyStatus.SUGGESTED,
      suggestedById: userId,
      claimMode: BountyClaimMode.SINGLE, // Default
      claimExpiryDays: 14, // Default
      evidenceDescription,
    },
  })

  // Associate any pending attachments with this bounty
  if (id) {
    await prisma.attachment.updateMany({
      where: {
        referenceType: AttachmentReferenceType.PENDING_BOUNTY,
        referenceId: id,
        userId, // Only associate attachments uploaded by this user
      },
      data: {
        referenceType: AttachmentReferenceType.BOUNTY,
      },
    })
  }

  // Notify founder about the suggestion (fire and forget)
  createNotifications({
    prisma: globalPrisma,
    type: NotificationType.BOUNTY_SUGGESTED,
    referenceType: NotificationReferenceType.BOUNTY,
    referenceId: bounty.id,
    actorId: userId,
    recipientIds: [project.founderId],
  }).catch((err) => {
    console.error('Failed to create suggestion notification:', err)
  })

  return {
    success: true,
    bounty: {
      id: bounty.id,
      number: bounty.number,
      status: bounty.status,
      title: bounty.title,
      description: bounty.description,
    },
  }
}

// ================================
// Approve Suggestion Service
// ================================

export interface ApproveSuggestionParams {
  prisma: PrismaClientOrTx
  bountyId: string
  userId: string // Founder approving the suggestion
  /** Points to assign (null = keep in backlog) */
  points?: number | null
  /** Optional updated title */
  title?: string
  /** Optional updated description */
  description?: string
  /** Optional updated evidence description */
  evidenceDescription?: string | null
  /** Optional label IDs to attach */
  labelIds?: string[]
}

export interface ApproveSuggestionResult {
  success: true
  bounty: {
    id: string
    number: number
    status: string
    title: string
    points: number | null
  }
}

export type ApproveSuggestionError =
  | { success: false; code: 'NOT_FOUND'; message: string }
  | { success: false; code: 'FORBIDDEN'; message: string }
  | { success: false; code: 'NOT_SUGGESTED'; message: string }

/**
 * Approve a suggested bounty - moves it from SUGGESTED to BACKLOG or OPEN
 *
 * This handles:
 * - Validating bounty exists
 * - Validating ownership (founder check)
 * - Checking bounty is in SUGGESTED status
 * - Optionally assigning points and updating fields
 * - Transitioning to BACKLOG (no points) or OPEN (with points)
 * - Adding labels if provided
 * - Notifying the suggester
 */
export async function approveSuggestion({
  prisma,
  bountyId,
  userId,
  points,
  title,
  description,
  evidenceDescription,
  labelIds,
}: ApproveSuggestionParams): Promise<
  ApproveSuggestionResult | ApproveSuggestionError
> {
  const bounty = await prisma.bounty.findUnique({
    where: { id: bountyId },
    include: {
      project: { select: { founderId: true } },
    },
  })

  if (!bounty) {
    return { success: false, code: 'NOT_FOUND', message: 'Bounty not found' }
  }

  if (bounty.project.founderId !== userId) {
    return {
      success: false,
      code: 'FORBIDDEN',
      message: 'You do not own this project',
    }
  }

  if (bounty.status !== BountyStatus.SUGGESTED) {
    return {
      success: false,
      code: 'NOT_SUGGESTED',
      message: 'Only suggested bounties can be approved',
    }
  }

  // Determine new status based on points
  const finalPoints = points !== undefined ? points : null
  const newStatus =
    finalPoints === null ? BountyStatus.BACKLOG : BountyStatus.OPEN

  // Update the bounty
  const updated = await prisma.bounty.update({
    where: { id: bountyId },
    data: {
      status: newStatus,
      points: finalPoints,
      ...(title && { title }),
      ...(description && { description }),
      ...(evidenceDescription !== undefined && { evidenceDescription }),
    },
  })

  // Add labels if provided
  if (labelIds && labelIds.length > 0) {
    await prisma.bountyLabel.createMany({
      data: labelIds.map((labelId) => ({
        bountyId,
        labelId,
      })),
    })
  }

  // Create status change event
  await prisma.bountyEvent.create({
    data: {
      bountyId,
      userId,
      type: BountyEventType.STATUS_CHANGE,
      fromStatus: BountyStatus.SUGGESTED,
      toStatus: newStatus,
      note: 'Suggestion approved',
    },
  })

  // Notify the suggester (fire and forget)
  if (bounty.suggestedById) {
    createNotifications({
      prisma: globalPrisma,
      type: NotificationType.BOUNTY_SUGGESTION_APPROVED,
      referenceType: NotificationReferenceType.BOUNTY,
      referenceId: bountyId,
      actorId: userId,
      recipientIds: [bounty.suggestedById],
    }).catch((err) => {
      console.error('Failed to create approval notification:', err)
    })
  }

  return {
    success: true,
    bounty: {
      id: updated.id,
      number: updated.number,
      status: updated.status,
      title: updated.title,
      points: updated.points,
    },
  }
}

// ================================
// Reject Suggestion Service
// ================================

export interface RejectSuggestionParams {
  prisma: PrismaClientOrTx
  bountyId: string
  userId: string // Founder rejecting the suggestion
  reason?: string
}

export interface RejectSuggestionResult {
  success: true
  bounty: { id: string; status: string }
}

export type RejectSuggestionError =
  | { success: false; code: 'NOT_FOUND'; message: string }
  | { success: false; code: 'FORBIDDEN'; message: string }
  | { success: false; code: 'NOT_SUGGESTED'; message: string }

/**
 * Reject a suggested bounty - moves it to CLOSED status
 *
 * This handles:
 * - Validating bounty exists
 * - Validating ownership (founder check)
 * - Checking bounty is in SUGGESTED status
 * - Transitioning to CLOSED
 * - Notifying the suggester with optional reason
 */
export async function rejectSuggestion({
  prisma,
  bountyId,
  userId,
  reason,
}: RejectSuggestionParams): Promise<
  RejectSuggestionResult | RejectSuggestionError
> {
  const bounty = await prisma.bounty.findUnique({
    where: { id: bountyId },
    include: {
      project: { select: { founderId: true } },
    },
  })

  if (!bounty) {
    return { success: false, code: 'NOT_FOUND', message: 'Bounty not found' }
  }

  if (bounty.project.founderId !== userId) {
    return {
      success: false,
      code: 'FORBIDDEN',
      message: 'You do not own this project',
    }
  }

  if (bounty.status !== BountyStatus.SUGGESTED) {
    return {
      success: false,
      code: 'NOT_SUGGESTED',
      message: 'Only suggested bounties can be rejected',
    }
  }

  // Update the bounty to CLOSED
  const updated = await prisma.bounty.update({
    where: { id: bountyId },
    data: { status: BountyStatus.CLOSED },
  })

  // Create status change event with reason in content field (displayed in activity feed)
  await prisma.bountyEvent.create({
    data: {
      bountyId,
      userId,
      type: BountyEventType.STATUS_CHANGE,
      fromStatus: BountyStatus.SUGGESTED,
      toStatus: BountyStatus.CLOSED,
      content: reason || 'Suggestion rejected',
    },
  })

  // Notify the suggester (fire and forget)
  if (bounty.suggestedById) {
    createNotifications({
      prisma: globalPrisma,
      type: NotificationType.BOUNTY_SUGGESTION_REJECTED,
      referenceType: NotificationReferenceType.BOUNTY,
      referenceId: bountyId,
      actorId: userId,
      recipientIds: [bounty.suggestedById],
    }).catch((err) => {
      console.error('Failed to create rejection notification:', err)
    })
  }

  return {
    success: true,
    bounty: { id: updated.id, status: updated.status },
  }
}
