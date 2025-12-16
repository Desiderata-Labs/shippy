import { prisma as globalPrisma } from '@/lib/db/server'
import {
  BountyStatus,
  ClaimStatus,
  NotificationReferenceType,
  NotificationType,
  SubmissionEventType,
  SubmissionStatus,
} from '@/lib/db/types'
import {
  formatAutoApproveComment,
  getInstallationOctokit,
} from '@/lib/github/server'
import { routes } from '@/lib/routes'
import { createNotifications } from '@/server/routers/notification'
import type { Prisma, PrismaClient } from '@prisma/client'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://shippy.sh'

// Type for either PrismaClient or a transaction client
type PrismaClientOrTx = PrismaClient | Prisma.TransactionClient

/**
 * Approve a submission - shared logic used by both tRPC and webhooks
 *
 * This handles:
 * - Updating submission status to APPROVED
 * - Updating claim status to COMPLETED
 * - Creating audit trail event
 * - Auto-expanding pool capacity if needed
 * - Marking bounty as COMPLETED if no remaining active claims
 * - Creating notification for contributor
 * - Posting GitHub comment if linked to a PR
 */
export async function approveSubmission({
  prisma,
  submissionId,
  pointsAwarded,
  actorId,
  note,
}: {
  prisma: PrismaClientOrTx
  submissionId: string
  pointsAwarded: number
  actorId: string // founder ID or system ID doing the approval
  note?: string
}): Promise<void> {
  // Fetch submission with all needed relations
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      bounty: {
        include: {
          project: {
            include: {
              rewardPool: true,
            },
          },
        },
      },
    },
  })

  if (!submission) {
    throw new Error(`Submission not found: ${submissionId}`)
  }

  const previousStatus = submission.status
  const project = submission.bounty.project
  const rewardPool = project.rewardPool
  const bountyDisplayId = `${project.projectKey}-${submission.bounty.number}`

  // Auto-expand pool capacity if needed
  if (rewardPool) {
    const earnedResult = await prisma.submission.aggregate({
      where: {
        bounty: { projectId: project.id },
        status: SubmissionStatus.APPROVED,
        pointsAwarded: { not: null },
      },
      _sum: { pointsAwarded: true },
    })
    const currentEarned = earnedResult._sum.pointsAwarded ?? 0
    const newTotalEarned = currentEarned + pointsAwarded

    if (newTotalEarned > rewardPool.poolCapacity) {
      const dilutionPercent =
        ((newTotalEarned - rewardPool.poolCapacity) / newTotalEarned) * 100

      await prisma.rewardPool.update({
        where: { id: rewardPool.id },
        data: { poolCapacity: newTotalEarned },
      })

      await prisma.poolExpansionEvent.create({
        data: {
          rewardPoolId: rewardPool.id,
          previousCapacity: rewardPool.poolCapacity,
          newCapacity: newTotalEarned,
          reason: `Auto-expanded when awarding ${pointsAwarded} pts for ${bountyDisplayId}`,
          dilutionPercent,
        },
      })
    }
  }

  // Update submission status
  await prisma.submission.update({
    where: { id: submissionId },
    data: {
      status: SubmissionStatus.APPROVED,
      pointsAwarded,
      approvedAt: new Date(),
      rejectedAt: null,
      rejectionNote: null,
    },
  })

  // Update claim status to COMPLETED
  await prisma.bountyClaim.updateMany({
    where: {
      bountyId: submission.bountyId,
      userId: submission.userId,
    },
    data: { status: ClaimStatus.COMPLETED },
  })

  // Create audit trail event
  await prisma.submissionEvent.create({
    data: {
      submissionId,
      userId: actorId,
      type: SubmissionEventType.STATUS_CHANGE,
      fromStatus: previousStatus,
      toStatus: SubmissionStatus.APPROVED,
      note: note || null,
    },
  })

  // Check if bounty should be marked as completed
  const activeClaims = await prisma.bountyClaim.count({
    where: {
      bountyId: submission.bountyId,
      status: { in: [ClaimStatus.ACTIVE, ClaimStatus.SUBMITTED] },
    },
  })

  if (activeClaims === 0) {
    await prisma.bounty.update({
      where: { id: submission.bountyId },
      data: { status: BountyStatus.COMPLETED },
    })
  }

  // Create notification for contributor (fire and forget, uses global prisma)
  createNotifications({
    prisma: globalPrisma,
    type: NotificationType.SUBMISSION_APPROVED,
    referenceType: NotificationReferenceType.SUBMISSION,
    referenceId: submissionId,
    actorId,
    recipientIds: [submission.userId],
  }).catch((err) => {
    console.error('Failed to create approval notification:', err)
  })

  // Post GitHub comment if linked to a PR (fire and forget, uses global prisma)
  notifyGitHubPRApproval({
    prisma: globalPrisma,
    submissionId,
    bountyIdentifier: bountyDisplayId,
    bountyTitle: submission.bounty.title,
    bountyUrl: `${APP_URL}${routes.project.bountyDetail({ slug: project.slug, bountyId: submission.bountyId })}`,
    pointsAwarded,
  }).catch((err) => {
    console.error('Failed to notify GitHub PR:', err)
  })
}

/**
 * Post a comment to GitHub PR when a submission is approved
 */
async function notifyGitHubPRApproval({
  prisma,
  submissionId,
  bountyIdentifier,
  bountyTitle,
  bountyUrl,
  pointsAwarded,
}: {
  prisma: typeof globalPrisma
  submissionId: string
  bountyIdentifier: string
  bountyTitle: string
  bountyUrl: string
  pointsAwarded: number
}): Promise<void> {
  const prLink = await prisma.gitHubPRLink.findUnique({
    where: { submissionId },
  })

  if (!prLink) return

  const connection = await prisma.gitHubConnection.findFirst({
    where: { repoId: prLink.repoId },
  })

  if (!connection) return

  const octokit = await getInstallationOctokit(connection.installationId)
  const [owner, repo] = connection.repoFullName.split('/')

  const comment = formatAutoApproveComment({
    identifier: bountyIdentifier,
    title: bountyTitle,
    points: pointsAwarded,
    status: BountyStatus.COMPLETED,
    url: bountyUrl,
  })

  await octokit.issues.createComment({
    owner,
    repo,
    issue_number: prLink.prNumber,
    body: comment,
  })
}

// ================================
// Create Submission Service
// ================================

export interface CreateSubmissionParams {
  prisma: PrismaClientOrTx
  bountyId: string
  userId: string
  description: string
  isDraft?: boolean
  /** GitHub PR link data (optional) */
  githubPRLink?: {
    repoId: number
    prNumber: number
    prNodeId: string
    prUrl: string
  }
  /** If true, skip the claim requirement check (for auto-creation flows) */
  skipClaimCheck?: boolean
}

export interface CreateSubmissionResult {
  success: true
  submission: { id: string }
}

export type CreateSubmissionError =
  | { success: false; code: 'NOT_FOUND'; message: string }
  | { success: false; code: 'NO_CLAIM'; message: string }
  | { success: false; code: 'ALREADY_SUBMITTED'; message: string }

/**
 * Create a submission - shared logic used by both tRPC and webhooks
 *
 * This handles:
 * - Validating bounty exists
 * - Checking user has an active claim (unless skipClaimCheck)
 * - Checking for existing submission
 * - Creating the submission with optional GitHub PR link
 * - Updating claim status to SUBMITTED
 * - Notifying founder (unless draft)
 */
export async function createSubmission({
  prisma,
  bountyId,
  userId,
  description,
  isDraft = false,
  githubPRLink,
  skipClaimCheck = false,
}: CreateSubmissionParams): Promise<
  CreateSubmissionResult | CreateSubmissionError
> {
  // Verify bounty exists
  const bounty = await prisma.bounty.findUnique({
    where: { id: bountyId },
    include: {
      project: { select: { founderId: true } },
    },
  })

  if (!bounty) {
    return { success: false, code: 'NOT_FOUND', message: 'Bounty not found' }
  }

  // Check if user has an active claim (unless skipped)
  let claim = null
  if (!skipClaimCheck) {
    claim = await prisma.bountyClaim.findFirst({
      where: {
        bountyId,
        userId,
        status: ClaimStatus.ACTIVE,
      },
    })

    if (!claim) {
      return {
        success: false,
        code: 'NO_CLAIM',
        message: 'You must claim this bounty before submitting',
      }
    }
  } else {
    // Even if skipping check, try to find the claim for status update
    claim = await prisma.bountyClaim.findFirst({
      where: {
        bountyId,
        userId,
        status: ClaimStatus.ACTIVE,
      },
    })
  }

  // Check for existing non-rejected submission
  const existingSubmission = await prisma.submission.findFirst({
    where: {
      bountyId,
      userId,
      status: { notIn: [SubmissionStatus.REJECTED] },
    },
  })

  if (existingSubmission) {
    return {
      success: false,
      code: 'ALREADY_SUBMITTED',
      message: 'You already have a submission for this bounty',
    }
  }

  // Create submission
  const submission = await prisma.submission.create({
    data: {
      bountyId,
      userId,
      description,
      status: isDraft ? SubmissionStatus.DRAFT : SubmissionStatus.PENDING,
      ...(githubPRLink && {
        githubPRLink: {
          create: {
            repoId: githubPRLink.repoId,
            prNumber: githubPRLink.prNumber,
            prNodeId: githubPRLink.prNodeId,
            prUrl: githubPRLink.prUrl,
          },
        },
      }),
    },
  })

  // Update claim status to SUBMITTED (if we have a claim)
  if (claim) {
    await prisma.bountyClaim.update({
      where: { id: claim.id },
      data: { status: ClaimStatus.SUBMITTED },
    })
  }

  // Notify founder about new submission (if not draft, fire and forget)
  if (!isDraft) {
    createNotifications({
      prisma: globalPrisma,
      type: NotificationType.SUBMISSION_CREATED,
      referenceType: NotificationReferenceType.SUBMISSION,
      referenceId: submission.id,
      actorId: userId,
      recipientIds: [bounty.project.founderId],
    }).catch((err) => {
      console.error('Failed to create submission notification:', err)
    })
  }

  return { success: true, submission: { id: submission.id } }
}
