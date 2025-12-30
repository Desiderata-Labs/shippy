import { prisma as globalPrisma } from '@/lib/db/server'
import {
  NotificationReferenceType,
  NotificationType,
  PayoutPaymentStatus,
  StripeConnectAccountStatus,
  SubmissionStatus,
} from '@/lib/db/types'
import { calculateExpectedFeeFromGross } from '@/lib/stripe/fees'
import { createNotifications } from '@/server/routers/notification'
import { transferFunds } from '@/server/services/stripe'
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
  /** What founder actually pays (pool * utilization) */
  founderPaysCents: number
  /** Stripe processing fee (comes out of founderPaysCents) */
  stripeFeeCents: number
  /** Platform fee (comes out of founderPaysCents) */
  platformFeeCents: number
  /** What contributors receive (founderPaysCents - stripeFeeCents - platformFeeCents) */
  distributedAmountCents: number
  totalEarnedPoints: number
  breakdown: PayoutBreakdown[]
}

/**
 * Calculate payout amounts based on contributor points
 *
 * Fee model:
 * - Shippy takes 2% of the FULL pool (regardless of utilization)
 * - Contributors get the remaining 98% of pool, scaled by utilization
 * - Founder pays: Shippy's full share + Contributors' utilized share
 * - Stripe fee comes out of founder's payment, absorbed by contributors
 *
 * Example at 2.5% utilization of $1,000 pool:
 * - Shippy: 2% of $1,000 = $20.00 (full, not scaled)
 * - Contributors (pre-Stripe): 98% of $1,000 × 2.5% = $24.50
 * - Founder pays: $44.50
 * - Stripe takes: ~$1.59
 * - Contributors get: $22.91 ($44.50 - $20 - $1.59)
 */
export function calculatePayout({
  reportedProfitCents,
  poolPercentage,
  poolCapacity,
  platformFeePercentage,
  contributors,
}: CalculatePayoutParams): CalculatePayoutResult {
  // Max pool amount (if 100% utilized)
  const poolAmountCents = Math.floor(
    (reportedProfitCents * poolPercentage) / 100,
  )

  // Platform fee = 2% of FULL pool (Shippy gets this regardless of utilization)
  const platformFeeCents = Math.floor(
    (poolAmountCents * platformFeePercentage) / 100,
  )

  // Max distributable to actual contributors (remaining 98% of pool)
  const maxDistributableCents = poolAmountCents - platformFeeCents

  const totalEarnedPoints = contributors.reduce((sum, c) => sum + c.points, 0)

  // Utilization ratio (capped at 100%)
  const utilizationRatio = Math.min(totalEarnedPoints / poolCapacity, 1)

  // What contributors would get if no Stripe fee (scaled by utilization)
  const potentialContributorCents = Math.floor(
    maxDistributableCents * utilizationRatio,
  )

  // What founder pays (full Shippy fee + utilized contributor amount)
  const founderPaysCents = platformFeeCents + potentialContributorCents

  // Stripe takes their fee from the gross amount
  // Uses expected fee based on likely payment method (ACH for >= $500)
  const stripeFeeCents = calculateExpectedFeeFromGross(founderPaysCents)

  // Contributors get what's left after Shippy and Stripe
  const distributedAmountCents = Math.max(
    0,
    founderPaysCents - platformFeeCents - stripeFeeCents,
  )

  // Calculate each contributor's share
  const breakdown = contributors.map((c) => {
    const amountCents =
      totalEarnedPoints > 0
        ? Math.floor((distributedAmountCents * c.points) / totalEarnedPoints)
        : 0
    // sharePercent is % of what founder pays (before fees)
    const sharePercent =
      founderPaysCents > 0 ? (amountCents / founderPaysCents) * 100 : 0
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
    founderPaysCents,
    stripeFeeCents,
    platformFeeCents,
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
    paymentStatus: string // PayoutPaymentStatus
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
  // Fees come OUT of the pool (contributors are diluted, founder cost capped at pool %)
  const {
    poolAmountCents,
    founderPaysCents,
    stripeFeeCents,
    platformFeeCents,
    distributedAmountCents,
    totalEarnedPoints,
    breakdown,
  } = calculatePayout({
    reportedProfitCents,
    poolPercentage: project.rewardPool.poolPercentage,
    poolCapacity: project.rewardPool.poolCapacity,
    platformFeePercentage: project.rewardPool.platformFeePercentage,
    contributors,
  })

  // Create payout with recipients
  const payout = await prisma.payout.create({
    data: {
      projectId,
      periodStart,
      periodEnd,
      periodLabel,
      reportedProfitCents,
      poolAmountCents,
      distributedAmountCents,
      platformFeeCents,
      // Pre-calculate Stripe fees (founder pays founderPaysCents, fees come out of it)
      stripeFeeCents,
      founderTotalCents: founderPaysCents,
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
      paymentStatus: payout.paymentStatus,
      recipientCount: payout.recipients.length,
    },
  }
}

// ================================
// Process Stripe Payouts Service
// ================================

export interface ProcessStripePayoutsParams {
  prisma: PrismaClientOrTx
  payoutId: string
  userId: string // Founder initiating the payout
}

export interface StripePayoutRecipientResult {
  userId: string
  userName: string
  amountCents: number
  success: boolean
  transferId?: string
  error?: string
  reason?: 'no_account' | 'not_active' | 'below_minimum' | 'stripe_error'
}

export interface ProcessStripePayoutsResult {
  success: true
  payoutId: string
  results: StripePayoutRecipientResult[]
  successCount: number
  failureCount: number
  totalTransferredCents: number
}

export type ProcessStripePayoutsError =
  | { success: false; code: 'NOT_FOUND'; message: string }
  | { success: false; code: 'FORBIDDEN'; message: string }
  | { success: false; code: 'NOT_PAID'; message: string }
  | { success: false; code: 'ALREADY_PROCESSED'; message: string }
  | { success: false; code: 'NO_ELIGIBLE_RECIPIENTS'; message: string }

/**
 * Process automated Stripe payouts for a payout
 *
 * IMPORTANT: Founder must have paid first (paymentStatus = PAID)
 *
 * This handles:
 * - Validating payout exists and founder has paid
 * - Validating payout is in ANNOUNCED status (not already processed)
 * - Validating user is project founder
 * - Iterating through recipients and transferring funds via Stripe
 * - Recording transfer results and updating recipient records
 * - Updating payout status to SENT when complete
 * - Handling partial failures (some succeed, some fail)
 */
export async function processStripePayouts({
  prisma,
  payoutId,
  userId,
}: ProcessStripePayoutsParams): Promise<
  ProcessStripePayoutsResult | ProcessStripePayoutsError
> {
  const payout = await prisma.payout.findUnique({
    where: { id: payoutId },
    include: {
      project: { select: { id: true, founderId: true, slug: true } },
      recipients: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              stripeConnectAccountId: true,
              stripeConnectAccountStatus: true,
            },
          },
        },
      },
    },
  })

  if (!payout) {
    return { success: false, code: 'NOT_FOUND', message: 'Payout not found' }
  }

  if (payout.project.founderId !== userId) {
    return { success: false, code: 'FORBIDDEN', message: 'Access denied' }
  }

  // CRITICAL: Founder must have paid first
  if (payout.paymentStatus !== PayoutPaymentStatus.PAID) {
    return {
      success: false,
      code: 'NOT_PAID',
      message:
        'Founder must complete payment before transfers can be processed',
    }
  }

  // Filter to recipients who can receive payouts
  const eligibleRecipients = payout.recipients.filter((r) => {
    return (
      r.user.stripeConnectAccountId &&
      r.user.stripeConnectAccountStatus === StripeConnectAccountStatus.ACTIVE &&
      Number(r.amountCents) >= 50 // Stripe minimum
    )
  })

  if (eligibleRecipients.length === 0) {
    return {
      success: false,
      code: 'NO_ELIGIBLE_RECIPIENTS',
      message:
        'No recipients have connected Stripe accounts or amounts above minimum',
    }
  }

  const now = new Date()
  const results: StripePayoutRecipientResult[] = []
  let successCount = 0
  let failureCount = 0
  let totalTransferredCents = 0

  // Process each recipient
  for (const recipient of payout.recipients) {
    const amountCents = Number(recipient.amountCents)

    // Check eligibility
    if (!recipient.user.stripeConnectAccountId) {
      results.push({
        userId: recipient.userId,
        userName: recipient.user.name,
        amountCents,
        success: false,
        reason: 'no_account',
        error: 'User has not connected a Stripe account',
      })
      failureCount++
      continue
    }

    if (
      recipient.user.stripeConnectAccountStatus !==
      StripeConnectAccountStatus.ACTIVE
    ) {
      results.push({
        userId: recipient.userId,
        userName: recipient.user.name,
        amountCents,
        success: false,
        reason: 'not_active',
        error: 'Stripe account is not fully active',
      })
      failureCount++
      continue
    }

    if (amountCents < 50) {
      results.push({
        userId: recipient.userId,
        userName: recipient.user.name,
        amountCents,
        success: false,
        reason: 'below_minimum',
        error: 'Amount is below Stripe minimum ($0.50)',
      })
      failureCount++
      continue
    }

    // Attempt transfer
    const transferResult = await transferFunds({
      prisma,
      recipientUserId: recipient.userId,
      amountCents,
      metadata: {
        payoutId: payout.id,
        projectId: payout.project.id,
        periodLabel: payout.periodLabel,
      },
    })

    if (transferResult.success) {
      // Update recipient record with transfer ID
      await prisma.payoutRecipient.update({
        where: { id: recipient.id },
        data: {
          paidAt: now,
          stripeTransferId: transferResult.transferId,
        },
      })

      results.push({
        userId: recipient.userId,
        userName: recipient.user.name,
        amountCents,
        success: true,
        transferId: transferResult.transferId,
      })
      successCount++
      totalTransferredCents += amountCents
    } else {
      results.push({
        userId: recipient.userId,
        userName: recipient.user.name,
        amountCents,
        success: false,
        reason: 'stripe_error',
        error: transferResult.message,
      })
      failureCount++
    }
  }

  // Notify recipients who were paid
  const paidRecipientIds = results.filter((r) => r.success).map((r) => r.userId)

  if (paidRecipientIds.length > 0) {
    createNotifications({
      prisma: globalPrisma,
      type: NotificationType.PAYOUT_SENT,
      referenceType: NotificationReferenceType.PAYOUT,
      referenceId: payoutId,
      actorId: userId,
      recipientIds: paidRecipientIds,
    }).catch((err) => {
      console.error('Failed to create payout sent notifications:', err)
    })
  }

  return {
    success: true,
    payoutId: payout.id,
    results,
    successCount,
    failureCount,
    totalTransferredCents,
  }
}

// ================================
// Get Payout Stripe Readiness
// ================================

export interface GetPayoutStripeReadinessParams {
  prisma: PrismaClientOrTx
  payoutId: string
  userId: string
}

export interface RecipientStripeStatus {
  userId: string
  userName: string
  amountCents: number
  hasStripeAccount: boolean
  stripeAccountStatus: StripeConnectAccountStatus | null
  canReceive: boolean
  issue?: string
}

export interface GetPayoutStripeReadinessResult {
  success: true
  totalRecipients: number
  eligibleCount: number
  ineligibleCount: number
  totalEligibleAmountCents: number
  recipients: RecipientStripeStatus[]
}

export type GetPayoutStripeReadinessError =
  | { success: false; code: 'NOT_FOUND'; message: string }
  | { success: false; code: 'FORBIDDEN'; message: string }

/**
 * Check which recipients are ready to receive Stripe payouts
 *
 * This helps founders see who needs to connect Stripe before running payouts
 */
export async function getPayoutStripeReadiness({
  prisma,
  payoutId,
  userId,
}: GetPayoutStripeReadinessParams): Promise<
  GetPayoutStripeReadinessResult | GetPayoutStripeReadinessError
> {
  const payout = await prisma.payout.findUnique({
    where: { id: payoutId },
    include: {
      project: { select: { founderId: true } },
      recipients: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              stripeConnectAccountId: true,
              stripeConnectAccountStatus: true,
            },
          },
        },
      },
    },
  })

  if (!payout) {
    return { success: false, code: 'NOT_FOUND', message: 'Payout not found' }
  }

  if (payout.project.founderId !== userId) {
    return { success: false, code: 'FORBIDDEN', message: 'Access denied' }
  }

  const recipients: RecipientStripeStatus[] = payout.recipients.map((r) => {
    const amountCents = Number(r.amountCents)
    const hasStripeAccount = !!r.user.stripeConnectAccountId
    const stripeAccountStatus = r.user
      .stripeConnectAccountStatus as StripeConnectAccountStatus | null
    const isActive = stripeAccountStatus === StripeConnectAccountStatus.ACTIVE
    const aboveMinimum = amountCents >= 50

    let issue: string | undefined
    if (!hasStripeAccount) {
      issue = 'No Stripe account connected'
    } else if (!isActive) {
      issue = 'Stripe account setup incomplete'
    } else if (!aboveMinimum) {
      issue = 'Amount below minimum ($0.50)'
    }

    return {
      userId: r.userId,
      userName: r.user.name,
      amountCents,
      hasStripeAccount,
      stripeAccountStatus,
      canReceive: hasStripeAccount && isActive && aboveMinimum,
      issue,
    }
  })

  const eligibleCount = recipients.filter((r) => r.canReceive).length
  const ineligibleCount = recipients.filter((r) => !r.canReceive).length
  const totalEligibleAmountCents = recipients
    .filter((r) => r.canReceive)
    .reduce((sum, r) => sum + r.amountCents, 0)

  return {
    success: true,
    totalRecipients: recipients.length,
    eligibleCount,
    ineligibleCount,
    totalEligibleAmountCents,
    recipients,
  }
}
