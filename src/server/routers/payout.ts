import {
  PayoutRecipientStatus,
  PayoutStatus,
  SubmissionStatus,
} from '@/lib/db/types'
import { nanoId } from '@/lib/nanoid/schema'
import { protectedProcedure, publicProcedure, router } from '@/server/trpc'
import { TRPCError } from '@trpc/server'
import { z } from 'zod/v4'

// Validation schemas
const createPayoutSchema = z.object({
  projectId: nanoId(),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  periodLabel: z.string().min(1).max(50),
  reportedProfitCents: z.number().int().min(0),
})

const markSentSchema = z.object({
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
      return payouts
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
        (sum, p) => sum + p.poolAmountCents,
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
              poolAmountCents: latestPayout.poolAmountCents,
              status: latestPayout.status,
            }
          : null,
      }
    }),

  /**
   * Calculate potential payout (preview before creating)
   */
  previewPayout: protectedProcedure
    .input(
      z.object({
        projectId: nanoId(),
        reportedProfitCents: z.number().int().min(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Verify ownership
      const project = await ctx.prisma.project.findUnique({
        where: { id: input.projectId },
        include: { rewardPool: true },
      })

      if (!project || project.founderId !== ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' })
      }

      if (!project.rewardPool) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Project has no reward pool',
        })
      }

      // Get all contributors with points
      const contributors = await getContributorPoints(
        ctx.prisma,
        input.projectId,
      )

      // Calculate amounts using capacity-based model
      const poolPercentage = project.rewardPool.poolPercentage
      const poolCapacity = project.rewardPool.poolCapacity
      const platformFeePercentage = project.rewardPool.platformFeePercentage

      const poolAmountCents = Math.floor(
        (input.reportedProfitCents * poolPercentage) / 100,
      )
      const platformFeeCents = Math.floor(
        (poolAmountCents * platformFeePercentage) / 100,
      )
      const maxDistributableCents = poolAmountCents - platformFeeCents

      const totalEarnedPoints = contributors.reduce(
        (sum, c) => sum + c.points,
        0,
      )

      // Use capacity as denominator, but cap at 100% if earned > capacity
      const effectiveDenominator = Math.max(poolCapacity, totalEarnedPoints)

      // Only distribute for earned points (not full capacity)
      const distributedAmountCents = Math.floor(
        (maxDistributableCents * Math.min(totalEarnedPoints, poolCapacity)) /
          poolCapacity,
      )

      const breakdown = contributors.map((c) => ({
        userId: c.userId,
        userName: c.userName,
        userImage: c.userImage,
        points: c.points,
        sharePercent:
          effectiveDenominator > 0
            ? (c.points / effectiveDenominator) * 100
            : 0,
        amountCents:
          effectiveDenominator > 0
            ? Math.floor(
                (distributedAmountCents * c.points) / totalEarnedPoints,
              )
            : 0,
      }))

      return {
        reportedProfitCents: input.reportedProfitCents,
        poolPercentage,
        poolCapacity,
        poolAmountCents,
        platformFeePercentage,
        platformFeeCents,
        maxDistributableCents,
        distributedAmountCents,
        totalEarnedPoints,
        breakdown,
      }
    }),

  /**
   * Create a payout (founder only)
   */
  create: protectedProcedure
    .input(createPayoutSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const project = await ctx.prisma.project.findUnique({
        where: { id: input.projectId },
        include: { rewardPool: true },
      })

      if (!project || project.founderId !== ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' })
      }

      if (!project.rewardPool) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Project has no reward pool',
        })
      }

      // Get all contributors with points
      const contributors = await getContributorPoints(
        ctx.prisma,
        input.projectId,
      )

      if (contributors.length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No contributors with points to pay out',
        })
      }

      // Calculate amounts using capacity-based model
      const poolPercentage = project.rewardPool.poolPercentage
      const poolCapacity = project.rewardPool.poolCapacity
      const platformFeePercentage = project.rewardPool.platformFeePercentage

      const poolAmountCents = Math.floor(
        (input.reportedProfitCents * poolPercentage) / 100,
      )
      const platformFeeCents = Math.floor(
        (poolAmountCents * platformFeePercentage) / 100,
      )
      const maxDistributableCents = poolAmountCents - platformFeeCents

      const totalEarnedPoints = contributors.reduce(
        (sum, c) => sum + c.points,
        0,
      )

      // Use capacity as denominator, but cap at 100% if earned > capacity
      const effectiveDenominator = Math.max(poolCapacity, totalEarnedPoints)

      // Only distribute for earned points (not full capacity)
      const distributedAmountCents = Math.floor(
        (maxDistributableCents * Math.min(totalEarnedPoints, poolCapacity)) /
          poolCapacity,
      )

      // Create payout with recipients
      const payout = await ctx.prisma.payout.create({
        data: {
          projectId: input.projectId,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          periodLabel: input.periodLabel,
          reportedProfitCents: input.reportedProfitCents,
          poolAmountCents,
          platformFeeCents,
          totalPointsAtPayout: totalEarnedPoints,
          recipients: {
            create: contributors.map((c) => {
              const sharePercent = (c.points / effectiveDenominator) * 100
              const amountCents = Math.floor(
                (distributedAmountCents * c.points) / totalEarnedPoints,
              )
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

      return payout
    }),

  /**
   * Mark payout as sent (founder only)
   */
  markSent: protectedProcedure
    .input(markSentSchema)
    .mutation(async ({ ctx, input }) => {
      const payout = await ctx.prisma.payout.findUnique({
        where: { id: input.payoutId },
        include: { project: { select: { founderId: true } } },
      })

      if (!payout) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Payout not found' })
      }

      if (payout.project.founderId !== ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' })
      }

      return ctx.prisma.payout.update({
        where: { id: input.payoutId },
        data: {
          status: PayoutStatus.SENT,
          sentAt: new Date(),
          sentNote: input.note,
        },
      })
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
      })

      if (!recipient) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'You are not a recipient of this payout',
        })
      }

      const now = new Date()

      return ctx.prisma.payoutRecipient.update({
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
    }),

  /**
   * Get payouts where current user is a recipient
   */
  myPayouts: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.payoutRecipient.findMany({
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
