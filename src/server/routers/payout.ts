import {
  NotificationReferenceType,
  NotificationType,
  PayoutRecipientStatus,
  PayoutStatus,
  PoolType,
  SubmissionStatus,
} from '@/lib/db/types'
import { nanoId } from '@/lib/nanoid/zod'
import { createNotifications } from './notification'
import {
  protectedProcedure,
  publicProcedure,
  router,
  userError,
} from '@/server/trpc'
import { z } from 'zod/v4'

// Helper to convert BigInt cents fields to numbers for client-side arithmetic
// BigInt is used in DB to support large amounts, but JS arithmetic needs Number
type SerializeRecipient<T> = T extends { amountCents: bigint }
  ? Omit<T, 'amountCents'> & { amountCents: number }
  : T

type SerializePayout<T> = T extends {
  reportedProfitCents: bigint
  poolAmountCents: bigint
  platformFeeCents: bigint
}
  ? Omit<
      T,
      | 'reportedProfitCents'
      | 'poolAmountCents'
      | 'platformFeeCents'
      | 'recipients'
    > & {
      reportedProfitCents: number
      poolAmountCents: number
      platformFeeCents: number
    } & (T extends { recipients: Array<infer R> }
        ? { recipients: Array<SerializeRecipient<R>> }
        : object)
  : T

function serializePayout<
  T extends {
    reportedProfitCents: bigint
    poolAmountCents: bigint
    platformFeeCents: bigint
    recipients?: Array<{ amountCents: bigint }>
  },
>(payout: T): SerializePayout<T> {
  const result = {
    ...payout,
    reportedProfitCents: Number(payout.reportedProfitCents),
    poolAmountCents: Number(payout.poolAmountCents),
    platformFeeCents: Number(payout.platformFeeCents),
  }
  if ('recipients' in payout && Array.isArray(payout.recipients)) {
    ;(result as { recipients: unknown[] }).recipients = payout.recipients.map(
      (r) => ({
        ...r,
        amountCents: Number(r.amountCents),
      }),
    )
  }
  return result as SerializePayout<T>
}

function serializeRecipient<T extends { amountCents: bigint }>(
  recipient: T,
): Omit<T, 'amountCents'> & { amountCents: number } {
  return {
    ...recipient,
    amountCents: Number(recipient.amountCents),
  }
}

// Validation schemas
// For PROFIT_SHARE: use reportedProfitCents (pool amount = profit * percentage)
// For FIXED_BUDGET: use distributionCents (direct amount from budget)
const createPayoutSchema = z.object({
  projectId: nanoId(),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  periodLabel: z.string().min(1).max(50),
  // PROFIT_SHARE: reported profit amount
  reportedProfitCents: z.number().int().min(0).optional(),
  // FIXED_BUDGET: direct distribution amount
  distributionCents: z.number().int().min(1).optional(),
})

const markSentSchema = z.object({
  payoutId: nanoId(),
  note: z.string().optional(),
})

const markRecipientPaidSchema = z.object({
  recipientId: nanoId(),
  note: z.string().optional(),
})

const markAllPaidSchema = z.object({
  payoutId: nanoId(),
  note: z.string().optional(),
})

const confirmReceiptSchema = z.object({
  payoutId: nanoId(),
  confirmed: z.boolean(),
  note: z.string().optional(),
  disputeReason: z.string().optional(),
})

export const payoutRouter = router({
  /**
   * Get a single payout by ID
   */
  getById: publicProcedure
    .input(z.object({ payoutId: nanoId() }))
    .query(async ({ ctx, input }) => {
      const payout = await ctx.prisma.payout.findUnique({
        where: { id: input.payoutId },
        include: {
          project: {
            select: {
              id: true,
              name: true,
              slug: true,
              founderId: true,
              payoutVisibility: true,
              rewardPools: {
                where: { isDefault: true },
                take: 1,
                select: {
                  poolType: true,
                  poolPercentage: true,
                  poolCapacity: true,
                  platformFeePercentage: true,
                  budgetCents: true,
                  spentCents: true,
                },
              },
            },
          },
          // Include the specific reward pool this payout was made from
          rewardPool: {
            select: {
              poolType: true,
              poolPercentage: true,
              budgetCents: true,
            },
          },
          recipients: {
            include: {
              user: { select: { id: true, name: true, image: true } },
            },
            orderBy: { pointsAtPayout: 'desc' },
          },
        },
      })

      if (!payout) {
        throw userError('NOT_FOUND', 'Payout not found')
      }

      return serializePayout(payout)
    }),

  /**
   * Get payouts for a project (public summary, detailed for participants)
   */
  getByProject: publicProcedure
    .input(z.object({ projectId: nanoId() }))
    .query(async ({ ctx, input }) => {
      const payouts = await ctx.prisma.payout.findMany({
        where: { projectId: input.projectId },
        orderBy: { periodEnd: 'desc' },
        include: {
          recipients: {
            include: {
              user: { select: { id: true, name: true, image: true } },
            },
          },
        },
      })

      // Return payouts with recipient info
      // Note: In the future, we may want to filter amounts based on user role
      return payouts.map(serializePayout)
    }),

  /**
   * Get payout summary stats for a project
   */
  getProjectStats: publicProcedure
    .input(z.object({ projectId: nanoId() }))
    .query(async ({ ctx, input }) => {
      const payouts = await ctx.prisma.payout.findMany({
        where: { projectId: input.projectId },
        include: {
          recipients: true,
        },
      })

      const totalPaidOutCents = payouts.reduce(
        (sum, p) =>
          sum +
          p.recipients.reduce((rSum, r) => rSum + Number(r.amountCents), 0),
        0,
      )
      const totalPayouts = payouts.length
      const confirmedRecipients = payouts.flatMap((p) =>
        p.recipients.filter(
          (r) => r.status === PayoutRecipientStatus.CONFIRMED,
        ),
      ).length
      const totalRecipients = payouts.flatMap((p) => p.recipients).length

      const latestPayout = payouts[0]

      return {
        totalPaidOutCents,
        totalPayouts,
        confirmedRecipients,
        totalRecipients,
        confirmationRate:
          totalRecipients > 0 ? confirmedRecipients / totalRecipients : 0,
        latestPayout: latestPayout
          ? {
              periodLabel: latestPayout.periodLabel,
              poolAmountCents: Number(latestPayout.poolAmountCents),
              status: latestPayout.status,
            }
          : null,
      }
    }),

  /**
   * Calculate potential payout (preview before creating)
   * Supports both PROFIT_SHARE and FIXED_BUDGET pool types
   */
  previewPayout: protectedProcedure
    .input(
      z.object({
        projectId: nanoId(),
        // PROFIT_SHARE: reported profit amount
        reportedProfitCents: z.number().int().min(0).optional(),
        // FIXED_BUDGET: direct distribution amount
        distributionCents: z.number().int().min(1).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Verify ownership
      const project = await ctx.prisma.project.findUnique({
        where: { id: input.projectId },
        include: {
          rewardPools: {
            where: { isDefault: true },
            take: 1,
          },
        },
      })

      if (!project || project.founderId !== ctx.user.id) {
        throw userError('FORBIDDEN', 'Access denied')
      }

      const rewardPool = project.rewardPools[0]
      if (!rewardPool) {
        throw userError('BAD_REQUEST', 'Project has no reward pool')
      }

      const poolType = rewardPool.poolType || PoolType.PROFIT_SHARE

      // Get all contributors with points
      const contributors = await getContributorPoints(
        ctx.prisma,
        input.projectId,
      )

      const poolCapacity = rewardPool.poolCapacity
      const platformFeePercentage = rewardPool.platformFeePercentage
      const totalEarnedPoints = contributors.reduce(
        (sum, c) => sum + c.points,
        0,
      )

      let poolAmountCents: number
      let reportedProfitCents: number
      let poolPercentage: number

      if (poolType === PoolType.FIXED_BUDGET) {
        // FIXED_BUDGET: distributionCents is the pool amount directly
        const distributionCents = input.distributionCents ?? 0
        const budgetCents = Number(rewardPool.budgetCents ?? 0)
        const spentCents = Number(rewardPool.spentCents ?? 0)
        const remainingBudget = budgetCents - spentCents

        // Can't distribute more than remaining budget
        poolAmountCents = Math.min(distributionCents, remainingBudget)
        reportedProfitCents = 0 // Not applicable for fixed budget
        poolPercentage = 0 // Not applicable for fixed budget
      } else {
        // PROFIT_SHARE: calculate pool amount from profit percentage
        poolPercentage = rewardPool.poolPercentage ?? 0
        reportedProfitCents = input.reportedProfitCents ?? 0
        poolAmountCents = Math.floor(
          (reportedProfitCents * poolPercentage) / 100,
        )
      }

      const platformFeeCents = Math.floor(
        (poolAmountCents * platformFeePercentage) / 100,
      )
      const maxDistributableCents = poolAmountCents - platformFeeCents

      // Use capacity as denominator, but cap at 100% if earned > capacity
      const effectiveDenominator = Math.max(poolCapacity, totalEarnedPoints)

      // Only distribute for earned points (not full capacity)
      const distributedAmountCents = Math.floor(
        (maxDistributableCents * Math.min(totalEarnedPoints, poolCapacity)) /
          poolCapacity,
      )

      const breakdown = contributors.map((c) => {
        const amountCents =
          effectiveDenominator > 0 && totalEarnedPoints > 0
            ? Math.floor(
                (distributedAmountCents * c.points) / totalEarnedPoints,
              )
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

      // For FIXED_BUDGET, include budget info
      const budgetInfo = poolType === PoolType.FIXED_BUDGET ? {
        budgetCents: Number(rewardPool.budgetCents ?? 0),
        spentCents: Number(rewardPool.spentCents ?? 0),
        remainingCents: Number(rewardPool.budgetCents ?? 0) - Number(rewardPool.spentCents ?? 0),
      } : null

      return {
        poolType,
        reportedProfitCents,
        poolPercentage,
        poolCapacity,
        poolAmountCents,
        platformFeePercentage,
        platformFeeCents,
        maxDistributableCents,
        distributedAmountCents,
        totalEarnedPoints,
        breakdown,
        budgetInfo,
      }
    }),

  /**
   * Create a payout (founder only)
   * Supports both PROFIT_SHARE and FIXED_BUDGET pool types
   */
  create: protectedProcedure
    .input(createPayoutSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const project = await ctx.prisma.project.findUnique({
        where: { id: input.projectId },
        include: {
          rewardPools: {
            where: { isDefault: true },
            take: 1,
          },
        },
      })

      if (!project || project.founderId !== ctx.user.id) {
        throw userError('FORBIDDEN', 'Access denied')
      }

      const rewardPool = project.rewardPools[0]
      if (!rewardPool) {
        throw userError('BAD_REQUEST', 'Project has no reward pool')
      }

      const poolType = rewardPool.poolType || PoolType.PROFIT_SHARE

      // Get all contributors with points
      const contributors = await getContributorPoints(
        ctx.prisma,
        input.projectId,
      )

      if (contributors.length === 0) {
        throw userError('BAD_REQUEST', 'No contributors with points to pay out')
      }

      // Calculate amounts based on pool type
      const poolCapacity = rewardPool.poolCapacity
      const platformFeePercentage = rewardPool.platformFeePercentage

      let poolAmountCents: number
      let reportedProfitCents: number

      if (poolType === PoolType.FIXED_BUDGET) {
        // FIXED_BUDGET: distributionCents is the pool amount directly
        if (!input.distributionCents || input.distributionCents <= 0) {
          throw userError('BAD_REQUEST', 'Distribution amount is required for fixed budget pools')
        }
        
        const budgetCents = Number(rewardPool.budgetCents ?? 0)
        const spentCents = Number(rewardPool.spentCents ?? 0)
        const remainingBudget = budgetCents - spentCents

        if (input.distributionCents > remainingBudget) {
          throw userError('BAD_REQUEST', `Cannot distribute more than remaining budget ($${(remainingBudget / 100).toFixed(2)})`)
        }

        poolAmountCents = input.distributionCents
        reportedProfitCents = 0 // Not applicable
      } else {
        // PROFIT_SHARE: calculate pool amount from profit percentage
        if (!input.reportedProfitCents || input.reportedProfitCents <= 0) {
          throw userError('BAD_REQUEST', 'Reported profit is required for profit share pools')
        }
        
        const poolPercentage = rewardPool.poolPercentage ?? 0
        reportedProfitCents = input.reportedProfitCents
        poolAmountCents = Math.floor(
          (reportedProfitCents * poolPercentage) / 100,
        )
      }

      const platformFeeCents = Math.floor(
        (poolAmountCents * platformFeePercentage) / 100,
      )
      const maxDistributableCents = poolAmountCents - platformFeeCents

      const totalEarnedPoints = contributors.reduce(
        (sum, c) => sum + c.points,
        0,
      )

      // Only distribute for earned points (not full capacity)
      const distributedAmountCents = Math.floor(
        (maxDistributableCents * Math.min(totalEarnedPoints, poolCapacity)) /
          poolCapacity,
      )

      // Create payout with recipients (use transaction for FIXED_BUDGET to update spentCents)
      const payout = await ctx.prisma.$transaction(async (tx) => {
        // For FIXED_BUDGET, update the spentCents on the reward pool
        if (poolType === PoolType.FIXED_BUDGET) {
          await tx.rewardPool.update({
            where: { id: rewardPool.id },
            data: {
              spentCents: {
                increment: poolAmountCents,
              },
            },
          })
        }

        return tx.payout.create({
          data: {
            projectId: input.projectId,
            rewardPoolId: rewardPool.id,
            periodStart: input.periodStart,
            periodEnd: input.periodEnd,
            periodLabel: input.periodLabel,
            reportedProfitCents, // Use our calculated value (0 for FIXED_BUDGET)
            poolAmountCents,
            platformFeeCents,
            totalPointsAtPayout: totalEarnedPoints,
            poolCapacityAtPayout: poolCapacity,
            recipients: {
              create: contributors.map((c) => {
                const amountCents = Math.floor(
                  (distributedAmountCents * c.points) / totalEarnedPoints,
                )
                // sharePercent is % of total pool (including platform fee)
                const sharePercent =
                  poolAmountCents > 0 ? (amountCents / poolAmountCents) * 100 : 0
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
            recipients: {
              include: {
                user: {
                  select: { id: true, name: true, image: true, email: true },
                },
              },
            },
          },
        })
      })

      // Notify all recipients about the payout announcement
      const recipientIds = payout.recipients.map((r) => r.userId)
      createNotifications({
        prisma: ctx.prisma,
        type: NotificationType.PAYOUT_ANNOUNCED,
        referenceType: NotificationReferenceType.PAYOUT,
        referenceId: payout.id,
        actorId: ctx.user.id,
        recipientIds,
      }).catch((err) => {
        console.error('Failed to create payout announced notifications:', err)
      })

      return serializePayout(payout)
    }),

  /**
   * Mark payout as sent (founder only) - legacy, updates payout level
   */
  markSent: protectedProcedure
    .input(markSentSchema)
    .mutation(async ({ ctx, input }) => {
      const payout = await ctx.prisma.payout.findUnique({
        where: { id: input.payoutId },
        include: { project: { select: { founderId: true } } },
      })

      if (!payout) {
        throw userError('NOT_FOUND', 'Payout not found')
      }

      if (payout.project.founderId !== ctx.user.id) {
        throw userError('FORBIDDEN', 'Access denied')
      }

      const updated = await ctx.prisma.payout.update({
        where: { id: input.payoutId },
        data: {
          status: PayoutStatus.SENT,
          sentAt: new Date(),
          sentNote: input.note,
        },
      })
      return serializePayout(updated)
    }),

  /**
   * Mark a single recipient as paid (founder only)
   */
  markRecipientPaid: protectedProcedure
    .input(markRecipientPaidSchema)
    .mutation(async ({ ctx, input }) => {
      const recipient = await ctx.prisma.payoutRecipient.findUnique({
        where: { id: input.recipientId },
        include: {
          payout: {
            include: { project: { select: { founderId: true } } },
          },
        },
      })

      if (!recipient) {
        throw userError('NOT_FOUND', 'Recipient not found')
      }

      if (recipient.payout.project.founderId !== ctx.user.id) {
        throw userError('FORBIDDEN', 'Access denied')
      }

      const now = new Date()

      // Update the recipient
      const updated = await ctx.prisma.payoutRecipient.update({
        where: { id: input.recipientId },
        data: {
          paidAt: now,
          paidNote: input.note,
        },
      })

      // Notify recipient that their payout has been sent
      createNotifications({
        prisma: ctx.prisma,
        type: NotificationType.PAYOUT_SENT,
        referenceType: NotificationReferenceType.PAYOUT,
        referenceId: recipient.payoutId,
        actorId: ctx.user.id,
        recipientIds: [recipient.userId],
      }).catch((err) => {
        console.error('Failed to create payout sent notification:', err)
      })

      // Check if all recipients are now paid, update payout status if so
      const unpaidCount = await ctx.prisma.payoutRecipient.count({
        where: {
          payoutId: recipient.payoutId,
          paidAt: null,
        },
      })

      if (unpaidCount === 0) {
        await ctx.prisma.payout.update({
          where: { id: recipient.payoutId },
          data: {
            status: PayoutStatus.SENT,
            sentAt: now,
          },
        })
      }

      return serializeRecipient(updated)
    }),

  /**
   * Mark all recipients as paid at once (founder only)
   */
  markAllPaid: protectedProcedure
    .input(markAllPaidSchema)
    .mutation(async ({ ctx, input }) => {
      const payout = await ctx.prisma.payout.findUnique({
        where: { id: input.payoutId },
        include: { project: { select: { founderId: true } } },
      })

      if (!payout) {
        throw userError('NOT_FOUND', 'Payout not found')
      }

      if (payout.project.founderId !== ctx.user.id) {
        throw userError('FORBIDDEN', 'Access denied')
      }

      const now = new Date()

      // Get recipient IDs before updating (for notifications)
      const unpaidRecipients = await ctx.prisma.payoutRecipient.findMany({
        where: {
          payoutId: input.payoutId,
          paidAt: null,
        },
        select: { userId: true },
      })

      // Update all unpaid recipients
      await ctx.prisma.payoutRecipient.updateMany({
        where: {
          payoutId: input.payoutId,
          paidAt: null,
        },
        data: {
          paidAt: now,
          paidNote: input.note,
        },
      })

      // Notify all recipients that their payout has been sent
      const recipientIds = unpaidRecipients.map((r) => r.userId)
      if (recipientIds.length > 0) {
        createNotifications({
          prisma: ctx.prisma,
          type: NotificationType.PAYOUT_SENT,
          referenceType: NotificationReferenceType.PAYOUT,
          referenceId: input.payoutId,
          actorId: ctx.user.id,
          recipientIds,
        }).catch((err) => {
          console.error('Failed to create payout sent notifications:', err)
        })
      }

      // Update payout status
      const updatedPayout = await ctx.prisma.payout.update({
        where: { id: input.payoutId },
        data: {
          status: PayoutStatus.SENT,
          sentAt: now,
          sentNote: input.note,
        },
      })
      return serializePayout(updatedPayout)
    }),

  /**
   * Confirm or dispute receipt (recipient only)
   */
  confirmReceipt: protectedProcedure
    .input(confirmReceiptSchema)
    .mutation(async ({ ctx, input }) => {
      const recipient = await ctx.prisma.payoutRecipient.findFirst({
        where: {
          payoutId: input.payoutId,
          userId: ctx.user.id,
        },
        include: {
          payout: {
            include: { project: { select: { founderId: true } } },
          },
        },
      })

      if (!recipient) {
        throw userError('NOT_FOUND', 'You are not a recipient of this payout')
      }

      const now = new Date()

      const updated = await ctx.prisma.payoutRecipient.update({
        where: { id: recipient.id },
        data: input.confirmed
          ? {
              status: PayoutRecipientStatus.CONFIRMED,
              confirmedAt: now,
              confirmNote: input.note,
            }
          : {
              status: PayoutRecipientStatus.DISPUTED,
              disputedAt: now,
              disputeReason: input.disputeReason,
            },
      })

      // Notify founder about confirmation or dispute
      createNotifications({
        prisma: ctx.prisma,
        type: input.confirmed
          ? NotificationType.PAYOUT_CONFIRMED
          : NotificationType.PAYOUT_DISPUTED,
        referenceType: NotificationReferenceType.PAYOUT,
        referenceId: input.payoutId,
        actorId: ctx.user.id,
        recipientIds: [recipient.payout.project.founderId],
      }).catch((err) => {
        console.error('Failed to create payout confirmation notification:', err)
      })

      return serializeRecipient(updated)
    }),

  /**
   * Get payouts where current user is a recipient
   */
  myPayouts: protectedProcedure.query(async ({ ctx }) => {
    const recipients = await ctx.prisma.payoutRecipient.findMany({
      where: { userId: ctx.user.id },
      orderBy: { payout: { periodEnd: 'desc' } },
      include: {
        payout: {
          include: {
            project: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    })
    // Serialize BigInt fields for client consumption
    return recipients.map((r) => ({
      ...serializeRecipient(r),
      payout: serializePayout(r.payout),
    }))
  }),
})

/**
 * Helper to get all contributors with their total points for a project
 */
async function getContributorPoints(
  prisma: typeof import('@/lib/db/server').prisma,
  projectId: string,
) {
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
  const pointsByUser = new Map<
    string,
    {
      userId: string
      userName: string
      userImage: string | null
      points: number
    }
  >()

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
