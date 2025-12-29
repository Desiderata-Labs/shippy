import { PayoutRecipientStatus, PayoutStatus } from '@/lib/db/types'
import { nanoId } from '@/lib/nanoid/zod'
import {
  calculatePayout,
  confirmReceipt,
  createPayout,
  getContributorPoints,
  markAllPaid,
  markRecipientPaid,
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
        platformFeeCents,
        maxDistributableCents,
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
        platformFeePercentage: project.rewardPool.platformFeePercentage,
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
      const result = await markRecipientPaid({
        prisma: ctx.prisma,
        recipientId: input.recipientId,
        userId: ctx.user.id,
        note: input.note,
      })

      if (!result.success) {
        throw userError(
          result.code === 'FORBIDDEN' ? 'FORBIDDEN' : 'NOT_FOUND',
          result.message,
        )
      }

      // Fetch the updated recipient with bigint for serialization
      const recipient = await ctx.prisma.payoutRecipient.findUnique({
        where: { id: input.recipientId },
      })

      return serializeRecipient(recipient!)
    }),

  /**
   * Mark all recipients as paid at once (founder only)
   */
  markAllPaid: protectedProcedure
    .input(markAllPaidSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await markAllPaid({
        prisma: ctx.prisma,
        payoutId: input.payoutId,
        userId: ctx.user.id,
        note: input.note,
      })

      if (!result.success) {
        throw userError(
          result.code === 'FORBIDDEN' ? 'FORBIDDEN' : 'NOT_FOUND',
          result.message,
        )
      }

      // Fetch full payout for serialization
      const payout = await ctx.prisma.payout.findUnique({
        where: { id: input.payoutId },
      })

      return serializePayout(payout!)
    }),

  /**
   * Confirm or dispute receipt (recipient only)
   */
  confirmReceipt: protectedProcedure
    .input(confirmReceiptSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await confirmReceipt({
        prisma: ctx.prisma,
        payoutId: input.payoutId,
        userId: ctx.user.id,
        confirmed: input.confirmed,
        note: input.note,
        disputeReason: input.disputeReason,
      })

      if (!result.success) {
        throw userError('NOT_FOUND', result.message)
      }

      // Fetch the updated recipient with bigint for serialization
      const recipient = await ctx.prisma.payoutRecipient.findFirst({
        where: {
          payoutId: input.payoutId,
          userId: ctx.user.id,
        },
      })

      return serializeRecipient(recipient!)
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
