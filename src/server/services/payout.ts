import { prisma as globalPrisma } from '@/lib/db/server'
import {
  NotificationReferenceType,
  NotificationType,
  PayoutRecipientStatus,
  PayoutStatus,
  SubmissionStatus,
} from '@/lib/db/types'
import { createNotifications } from '@/server/routers/notification'
import type { Prisma, PrismaClient } from '@prisma/client'

// Type for either PrismaClient or a transaction client
type PrismaClientOrTx = PrismaClient | Prisma.TransactionClient

// ================================
// Get Contributor Points Service
// ================================

export interface ContributorPoints {
  userId: string
  userName: string
  userImage: string | null
  points: number
}

/**
 * Get all contributors with their total points for a project
 */
export async function getContributorPoints(
  prisma: PrismaClientOrTx,
  projectId: string,
): Promise<ContributorPoints[]> {
  // Get all approved submissions for this project
  const submissions = await prisma.submission.findMany({
    where: {
      bounty: { projectId },
      status: SubmissionStatus.APPROVED,
      pointsAwarded: { not: null },
    },
    select: {
      userId: true,
      pointsAwarded: true,
      user: { select: { id: true, name: true, image: true } },
    },
  })

  // Aggregate points by user
  const pointsByUser = new Map<string, ContributorPoints>()

  for (const sub of submissions) {
    const existing = pointsByUser.get(sub.userId)
    if (existing) {
      existing.points += sub.pointsAwarded ?? 0
    } else {
      pointsByUser.set(sub.userId, {
        userId: sub.userId,
        userName: sub.user.name,
        userImage: sub.user.image,
        points: sub.pointsAwarded ?? 0,
      })
    }
  }

  return Array.from(pointsByUser.values()).sort((a, b) => b.points - a.points)
}

// ================================
// Calculate Payout Service
// ================================

export interface CalculatePayoutParams {
  reportedProfitCents: number
  poolPercentage: number
  poolCapacity: number
  platformFeePercentage: number
  contributors: ContributorPoints[]
}

export interface PayoutBreakdown {
  userId: string
  userName: string
  userImage: string | null
  points: number
  sharePercent: number
  amountCents: number
}

export interface CalculatePayoutResult {
  poolAmountCents: number
  platformFeeCents: number
  maxDistributableCents: number
  distributedAmountCents: number
  totalEarnedPoints: number
  breakdown: PayoutBreakdown[]
}

/**
 * Calculate payout amounts based on contributor points
 *
 * This handles:
 * - Calculating pool amount from profit
 * - Calculating platform fee
 * - Calculating individual contributor shares using capacity-based model
 * - If earned points exceed capacity, capacity auto-expands (capped at 100%)
 */
export function calculatePayout({
  reportedProfitCents,
  poolPercentage,
  poolCapacity,
  platformFeePercentage,
  contributors,
}: CalculatePayoutParams): CalculatePayoutResult {
  const poolAmountCents = Math.floor(
    (reportedProfitCents * poolPercentage) / 100,
  )
  const platformFeeCents = Math.floor(
    (poolAmountCents * platformFeePercentage) / 100,
  )
  const maxDistributableCents = poolAmountCents - platformFeeCents

  const totalEarnedPoints = contributors.reduce((sum, c) => sum + c.points, 0)

  // Only distribute for earned points (not full capacity)
  const distributedAmountCents = Math.floor(
    (maxDistributableCents * Math.min(totalEarnedPoints, poolCapacity)) /
      poolCapacity,
  )

  const breakdown = contributors.map((c) => {
    const amountCents =
      totalEarnedPoints > 0
        ? Math.floor((distributedAmountCents * c.points) / totalEarnedPoints)
        : 0
    // sharePercent is % of total pool (including platform fee)
    const sharePercent =
      poolAmountCents > 0 ? (amountCents / poolAmountCents) * 100 : 0
    return {
      userId: c.userId,
      userName: c.userName,
      userImage: c.userImage,
      points: c.points,
      sharePercent,
      amountCents,
    }
  })

  return {
    poolAmountCents,
    platformFeeCents,
    maxDistributableCents,
    distributedAmountCents,
    totalEarnedPoints,
    breakdown,
  }
}

// ================================
// Create Payout Service
// ================================

export interface CreatePayoutParams {
  prisma: PrismaClientOrTx
  projectId: string
  userId: string // Founder creating the payout
  periodStart: Date
  periodEnd: Date
  periodLabel: string
  reportedProfitCents: number
}

export interface CreatePayoutResult {
  success: true
  payout: {
    id: string
    periodLabel: string
    reportedProfitCents: bigint
    poolAmountCents: bigint
    platformFeeCents: bigint
    totalPointsAtPayout: number
    poolCapacityAtPayout: number
    status: PayoutStatus
    recipientCount: number
  }
}

export type CreatePayoutError =
  | { success: false; code: 'NOT_FOUND'; message: string }
  | { success: false; code: 'FORBIDDEN'; message: string }
  | { success: false; code: 'NO_REWARD_POOL'; message: string }
  | { success: false; code: 'NO_CONTRIBUTORS'; message: string }

/**
 * Create a payout - shared logic used by both tRPC and MCP
 *
 * This handles:
 * - Validating project exists and user is founder
 * - Validating reward pool exists
 * - Getting contributors with points
 * - Calculating payout amounts using capacity-based model
 * - Creating payout record with recipients
 * - Notifying all recipients
 */
export async function createPayout({
  prisma,
  projectId,
  userId,
  periodStart,
  periodEnd,
  periodLabel,
  reportedProfitCents,
}: CreatePayoutParams): Promise<CreatePayoutResult | CreatePayoutError> {
  // Verify ownership
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { rewardPool: true },
  })

  if (!project) {
    return { success: false, code: 'NOT_FOUND', message: 'Project not found' }
  }

  if (project.founderId !== userId) {
    return { success: false, code: 'FORBIDDEN', message: 'Access denied' }
  }

  if (!project.rewardPool) {
    return {
      success: false,
      code: 'NO_REWARD_POOL',
      message: 'Project has no reward pool',
    }
  }

  // Get all contributors with points
  const contributors = await getContributorPoints(prisma, projectId)

  if (contributors.length === 0) {
    return {
      success: false,
      code: 'NO_CONTRIBUTORS',
      message: 'No contributors with points to pay out',
    }
  }

  // Calculate amounts using capacity-based model
  const { poolAmountCents, platformFeeCents, breakdown } = calculatePayout({
    reportedProfitCents,
    poolPercentage: project.rewardPool.poolPercentage,
    poolCapacity: project.rewardPool.poolCapacity,
    platformFeePercentage: project.rewardPool.platformFeePercentage,
    contributors,
  })

  const totalEarnedPoints = contributors.reduce((sum, c) => sum + c.points, 0)

  // Create payout with recipients
  const payout = await prisma.payout.create({
    data: {
      projectId,
      periodStart,
      periodEnd,
      periodLabel,
      reportedProfitCents,
      poolAmountCents,
      platformFeeCents,
      totalPointsAtPayout: totalEarnedPoints,
      poolCapacityAtPayout: project.rewardPool.poolCapacity,
      recipients: {
        create: contributors.map((c) => {
          const recipientBreakdown = breakdown.find(
            (b) => b.userId === c.userId,
          )
          const amountCents = recipientBreakdown?.amountCents ?? 0
          const sharePercent = recipientBreakdown?.sharePercent ?? 0
          return {
            userId: c.userId,
            pointsAtPayout: c.points,
            sharePercent,
            amountCents,
          }
        }),
      },
    },
    include: {
      recipients: true,
    },
  })

  // Notify all recipients about the payout announcement (fire and forget)
  const recipientIds = payout.recipients.map((r) => r.userId)
  createNotifications({
    prisma: globalPrisma,
    type: NotificationType.PAYOUT_ANNOUNCED,
    referenceType: NotificationReferenceType.PAYOUT,
    referenceId: payout.id,
    actorId: userId,
    recipientIds,
  }).catch((err) => {
    console.error('Failed to create payout announced notifications:', err)
  })

  return {
    success: true,
    payout: {
      id: payout.id,
      periodLabel: payout.periodLabel,
      reportedProfitCents: payout.reportedProfitCents,
      poolAmountCents: payout.poolAmountCents,
      platformFeeCents: payout.platformFeeCents,
      totalPointsAtPayout: payout.totalPointsAtPayout,
      poolCapacityAtPayout: payout.poolCapacityAtPayout,
      status: payout.status as PayoutStatus,
      recipientCount: payout.recipients.length,
    },
  }
}

// ================================
// Mark Recipient Paid Service
// ================================

export interface MarkRecipientPaidParams {
  prisma: PrismaClientOrTx
  recipientId: string
  userId: string // Founder marking paid
  note?: string
}

export interface MarkRecipientPaidResult {
  success: true
  recipient: {
    id: string
    paidAt: Date
    paidNote: string | null
  }
  payoutStatusUpdated: boolean
}

export type MarkRecipientPaidError =
  | { success: false; code: 'NOT_FOUND'; message: string }
  | { success: false; code: 'FORBIDDEN'; message: string }

/**
 * Mark a single recipient as paid
 *
 * This handles:
 * - Validating recipient exists
 * - Validating user is project founder
 * - Updating recipient with paidAt timestamp
 * - Notifying recipient
 * - Updating payout status to SENT if all recipients are now paid
 */
export async function markRecipientPaid({
  prisma,
  recipientId,
  userId,
  note,
}: MarkRecipientPaidParams): Promise<
  MarkRecipientPaidResult | MarkRecipientPaidError
> {
  const recipient = await prisma.payoutRecipient.findUnique({
    where: { id: recipientId },
    include: {
      payout: {
        include: { project: { select: { founderId: true } } },
      },
    },
  })

  if (!recipient) {
    return { success: false, code: 'NOT_FOUND', message: 'Recipient not found' }
  }

  if (recipient.payout.project.founderId !== userId) {
    return { success: false, code: 'FORBIDDEN', message: 'Access denied' }
  }

  const now = new Date()

  // Update the recipient
  const updated = await prisma.payoutRecipient.update({
    where: { id: recipientId },
    data: {
      paidAt: now,
      paidNote: note,
    },
  })

  // Notify recipient that their payout has been sent (fire and forget)
  createNotifications({
    prisma: globalPrisma,
    type: NotificationType.PAYOUT_SENT,
    referenceType: NotificationReferenceType.PAYOUT,
    referenceId: recipient.payoutId,
    actorId: userId,
    recipientIds: [recipient.userId],
  }).catch((err) => {
    console.error('Failed to create payout sent notification:', err)
  })

  // Check if all recipients are now paid, update payout status if so
  const unpaidCount = await prisma.payoutRecipient.count({
    where: {
      payoutId: recipient.payoutId,
      paidAt: null,
    },
  })

  let payoutStatusUpdated = false
  if (unpaidCount === 0) {
    await prisma.payout.update({
      where: { id: recipient.payoutId },
      data: {
        status: PayoutStatus.SENT,
        sentAt: now,
      },
    })
    payoutStatusUpdated = true
  }

  return {
    success: true,
    recipient: {
      id: updated.id,
      paidAt: updated.paidAt!,
      paidNote: updated.paidNote,
    },
    payoutStatusUpdated,
  }
}

// ================================
// Mark All Paid Service
// ================================

export interface MarkAllPaidParams {
  prisma: PrismaClientOrTx
  payoutId: string
  userId: string // Founder marking all paid
  note?: string
}

export interface MarkAllPaidResult {
  success: true
  payout: {
    id: string
    status: PayoutStatus
    sentAt: Date
  }
  recipientsUpdated: number
}

export type MarkAllPaidError =
  | { success: false; code: 'NOT_FOUND'; message: string }
  | { success: false; code: 'FORBIDDEN'; message: string }

/**
 * Mark all recipients as paid at once
 *
 * This handles:
 * - Validating payout exists
 * - Validating user is project founder
 * - Updating all unpaid recipients
 * - Notifying all recipients
 * - Updating payout status to SENT
 */
export async function markAllPaid({
  prisma,
  payoutId,
  userId,
  note,
}: MarkAllPaidParams): Promise<MarkAllPaidResult | MarkAllPaidError> {
  const payout = await prisma.payout.findUnique({
    where: { id: payoutId },
    include: { project: { select: { founderId: true } } },
  })

  if (!payout) {
    return { success: false, code: 'NOT_FOUND', message: 'Payout not found' }
  }

  if (payout.project.founderId !== userId) {
    return { success: false, code: 'FORBIDDEN', message: 'Access denied' }
  }

  const now = new Date()

  // Get recipient IDs before updating (for notifications)
  const unpaidRecipients = await prisma.payoutRecipient.findMany({
    where: {
      payoutId,
      paidAt: null,
    },
    select: { userId: true },
  })

  // Update all unpaid recipients
  const { count: recipientsUpdated } = await prisma.payoutRecipient.updateMany({
    where: {
      payoutId,
      paidAt: null,
    },
    data: {
      paidAt: now,
      paidNote: note,
    },
  })

  // Notify all recipients that their payout has been sent (fire and forget)
  const recipientIds = unpaidRecipients.map((r) => r.userId)
  if (recipientIds.length > 0) {
    createNotifications({
      prisma: globalPrisma,
      type: NotificationType.PAYOUT_SENT,
      referenceType: NotificationReferenceType.PAYOUT,
      referenceId: payoutId,
      actorId: userId,
      recipientIds,
    }).catch((err) => {
      console.error('Failed to create payout sent notifications:', err)
    })
  }

  // Update payout status
  const updatedPayout = await prisma.payout.update({
    where: { id: payoutId },
    data: {
      status: PayoutStatus.SENT,
      sentAt: now,
      sentNote: note,
    },
  })

  return {
    success: true,
    payout: {
      id: updatedPayout.id,
      status: updatedPayout.status as PayoutStatus,
      sentAt: updatedPayout.sentAt!,
    },
    recipientsUpdated,
  }
}

// ================================
// Confirm Receipt Service
// ================================

export interface ConfirmReceiptParams {
  prisma: PrismaClientOrTx
  payoutId: string
  userId: string // Recipient confirming
  confirmed: boolean
  note?: string
  disputeReason?: string
}

export interface ConfirmReceiptResult {
  success: true
  recipient: {
    id: string
    status: PayoutRecipientStatus
    confirmedAt: Date | null
    disputedAt: Date | null
  }
}

export type ConfirmReceiptError =
  | { success: false; code: 'NOT_FOUND'; message: string }
  | { success: false; code: 'NOT_RECIPIENT'; message: string }

/**
 * Confirm or dispute receipt of a payout
 *
 * This handles:
 * - Validating payout exists
 * - Validating user is a recipient
 * - Updating recipient status to CONFIRMED or DISPUTED
 * - Recording timestamp and note/reason
 * - Notifying founder
 */
export async function confirmReceipt({
  prisma,
  payoutId,
  userId,
  confirmed,
  note,
  disputeReason,
}: ConfirmReceiptParams): Promise<ConfirmReceiptResult | ConfirmReceiptError> {
  const recipient = await prisma.payoutRecipient.findFirst({
    where: {
      payoutId,
      userId,
    },
    include: {
      payout: {
        include: { project: { select: { founderId: true } } },
      },
    },
  })

  if (!recipient) {
    return {
      success: false,
      code: 'NOT_RECIPIENT',
      message: 'You are not a recipient of this payout',
    }
  }

  const now = new Date()

  const updated = await prisma.payoutRecipient.update({
    where: { id: recipient.id },
    data: confirmed
      ? {
          status: PayoutRecipientStatus.CONFIRMED,
          confirmedAt: now,
          confirmNote: note,
        }
      : {
          status: PayoutRecipientStatus.DISPUTED,
          disputedAt: now,
          disputeReason,
        },
  })

  // Notify founder about confirmation or dispute (fire and forget)
  createNotifications({
    prisma: globalPrisma,
    type: confirmed
      ? NotificationType.PAYOUT_CONFIRMED
      : NotificationType.PAYOUT_DISPUTED,
    referenceType: NotificationReferenceType.PAYOUT,
    referenceId: payoutId,
    actorId: userId,
    recipientIds: [recipient.payout.project.founderId],
  }).catch((err) => {
    console.error('Failed to create payout confirmation notification:', err)
  })

  return {
    success: true,
    recipient: {
      id: updated.id,
      status: updated.status as PayoutRecipientStatus,
      confirmedAt: updated.confirmedAt,
      disputedAt: updated.disputedAt,
    },
  }
}
