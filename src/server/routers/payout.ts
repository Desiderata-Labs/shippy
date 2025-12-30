import { nanoId } from '@/lib/nanoid/zod'
import {
  calculatePayout,
  createPayout,
  getContributorPoints,
} from '@/server/services/payout'
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
  distributedAmountCents: bigint
  platformFeeCents: bigint
}
  ? Omit<
      T,
      | 'reportedProfitCents'
      | 'poolAmountCents'
      | 'distributedAmountCents'
      | 'platformFeeCents'
      | 'stripeFeeCents'
      | 'founderTotalCents'
      | 'recipients'
    > & {
      reportedProfitCents: number
      poolAmountCents: number
      distributedAmountCents: number
      platformFeeCents: number
      stripeFeeCents: number | null
      founderTotalCents: number | null
    } & (T extends { recipients: Array<infer R> }
        ? { recipients: Array<SerializeRecipient<R>> }
        : object)
  : T

function serializePayout<
  T extends {
    reportedProfitCents: bigint
    poolAmountCents: bigint
    distributedAmountCents: bigint
    platformFeeCents: bigint
    stripeFeeCents?: bigint | null
    founderTotalCents?: bigint | null
    recipients?: Array<{ amountCents: bigint }>
  },
>(payout: T): SerializePayout<T> {
  const result = {
    ...payout,
    reportedProfitCents: Number(payout.reportedProfitCents),
    poolAmountCents: Number(payout.poolAmountCents),
    distributedAmountCents: Number(payout.distributedAmountCents),
    platformFeeCents: Number(payout.platformFeeCents),
    stripeFeeCents: payout.stripeFeeCents
      ? Number(payout.stripeFeeCents)
      : null,
    founderTotalCents: payout.founderTotalCents
      ? Number(payout.founderTotalCents)
      : null,
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
const createPayoutSchema = z.object({
  projectId: nanoId(),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  periodLabel: z.string().min(1).max(50),
  reportedProfitCents: z.number().int().min(0),
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
              rewardPool: {
                select: {
                  poolPercentage: true,
                  poolCapacity: true,
                  platformFeePercentage: true,
                },
              },
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
      // Count recipients who have been paid via Stripe transfer
      const paidRecipients = payouts.flatMap((p) =>
        p.recipients.filter((r) => r.paidAt !== null),
      ).length
      const totalRecipients = payouts.flatMap((p) => p.recipients).length

      const latestPayout = payouts[0]

      return {
        totalPaidOutCents,
        totalPayouts,
        paidRecipients,
        totalRecipients,
        paidRate: totalRecipients > 0 ? paidRecipients / totalRecipients : 0,
        latestPayout: latestPayout
          ? {
              periodLabel: latestPayout.periodLabel,
              poolAmountCents: Number(latestPayout.poolAmountCents),
              paymentStatus: latestPayout.paymentStatus,
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
        throw userError('FORBIDDEN', 'Access denied')
      }

      if (!project.rewardPool) {
        throw userError('BAD_REQUEST', 'Project has no reward pool')
      }

      // Get all contributors with points using shared service
      const contributors = await getContributorPoints(
        ctx.prisma,
        input.projectId,
      )

      // Calculate amounts using shared service
      const {
        poolAmountCents,
        founderPaysCents,
        stripeFeeCents,
        platformFeeCents,
        distributedAmountCents,
        totalEarnedPoints,
        breakdown,
      } = calculatePayout({
        reportedProfitCents: input.reportedProfitCents,
        poolPercentage: project.rewardPool.poolPercentage,
        poolCapacity: project.rewardPool.poolCapacity,
        platformFeePercentage: project.rewardPool.platformFeePercentage,
        contributors,
      })

      return {
        reportedProfitCents: input.reportedProfitCents,
        poolPercentage: project.rewardPool.poolPercentage,
        poolCapacity: project.rewardPool.poolCapacity,
        poolAmountCents,
        founderPaysCents,
        stripeFeeCents,
        platformFeePercentage: project.rewardPool.platformFeePercentage,
        platformFeeCents,
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
      const result = await createPayout({
        prisma: ctx.prisma,
        userId: ctx.user.id,
        projectId: input.projectId,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        periodLabel: input.periodLabel,
        reportedProfitCents: input.reportedProfitCents,
      })

      if (!result.success) {
        throw userError(
          result.code === 'FORBIDDEN' ? 'FORBIDDEN' : 'BAD_REQUEST',
          result.message,
        )
      }

      // Fetch full payout for response serialization
      const payout = await ctx.prisma.payout.findUnique({
        where: { id: result.payout.id },
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

      return serializePayout(payout!)
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
