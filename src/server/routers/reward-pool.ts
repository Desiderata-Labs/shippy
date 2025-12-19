import { PoolStatus, PoolType, SubmissionStatus } from '@/lib/db/types'
import { nanoId } from '@/lib/nanoid/zod'
import {
  protectedProcedure,
  publicProcedure,
  router,
  userError,
} from '@/server/trpc'
import { z } from 'zod/v4'

// Validation schemas
const createPoolSchema = z.object({
  projectId: nanoId(),
  name: z.string().max(100).optional(),
  poolType: z.nativeEnum(PoolType),
  isDefault: z.boolean().optional(),
  // PROFIT_SHARE fields
  poolPercentage: z.number().int().min(1).max(100).optional(),
  poolCapacity: z.number().int().min(100).optional(),
  payoutFrequency: z.enum(['MONTHLY', 'QUARTERLY']).optional(),
  profitBasis: z.enum(['NET_PROFIT', 'GROSS_REVENUE']).optional(),
  commitmentMonths: z.number().int().min(6).optional(),
  // FIXED_BUDGET fields
  budgetCents: z.number().int().min(100).optional(), // At least $1
})

const updatePoolSchema = z.object({
  id: nanoId(),
  name: z.string().max(100).optional().nullable(),
  status: z.nativeEnum(PoolStatus).optional(),
  isDefault: z.boolean().optional(),
  // PROFIT_SHARE fields
  poolPercentage: z.number().int().min(1).max(100).optional(),
  poolCapacity: z.number().int().min(100).optional(),
  payoutFrequency: z.enum(['MONTHLY', 'QUARTERLY']).optional(),
  profitBasis: z.enum(['NET_PROFIT', 'GROSS_REVENUE']).optional(),
  commitmentMonths: z.number().int().min(6).optional(),
  // FIXED_BUDGET fields
  budgetCents: z.number().int().min(100).optional(),
})

// Helper to serialize BigInt fields
function serializePool<
  T extends { budgetCents?: bigint | null; spentCents?: bigint | null },
>(pool: T) {
  return {
    ...pool,
    budgetCents: pool.budgetCents != null ? Number(pool.budgetCents) : null,
    spentCents: pool.spentCents != null ? Number(pool.spentCents) : null,
  }
}

export const rewardPoolRouter = router({
  /**
   * Get all pools for a project
   */
  getByProject: publicProcedure
    .input(z.object({ projectId: nanoId() }))
    .query(async ({ ctx, input }) => {
      const pools = await ctx.prisma.rewardPool.findMany({
        where: { projectId: input.projectId },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        include: {
          _count: {
            select: {
              bounties: true,
              payouts: true,
            },
          },
          expansionEvents: {
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
        },
      })

      return pools.map(serializePool)
    }),

  /**
   * Get a single pool by ID with detailed stats
   */
  getById: publicProcedure
    .input(z.object({ id: nanoId() }))
    .query(async ({ ctx, input }) => {
      const pool = await ctx.prisma.rewardPool.findUnique({
        where: { id: input.id },
        include: {
          project: {
            select: { id: true, slug: true, name: true, founderId: true },
          },
          _count: {
            select: {
              bounties: true,
              payouts: true,
            },
          },
          expansionEvents: {
            orderBy: { createdAt: 'desc' },
          },
        },
      })

      if (!pool) {
        throw userError('NOT_FOUND', 'Pool not found')
      }

      // Calculate earned points (sum of all approved submissions' points)
      const submissions = await ctx.prisma.submission.findMany({
        where: {
          bounty: { rewardPoolId: pool.id },
          status: SubmissionStatus.APPROVED,
          pointsAwarded: { not: null },
        },
        select: { pointsAwarded: true },
      })
      const earnedPoints = submissions.reduce(
        (sum, s) => sum + (s.pointsAwarded ?? 0),
        0,
      )

      return {
        ...serializePool(pool),
        stats: {
          earnedPoints,
          availablePoints: pool.poolCapacity - earnedPoints,
          utilizationPercent:
            pool.poolCapacity > 0
              ? Math.min((earnedPoints / pool.poolCapacity) * 100, 100)
              : 0,
        },
      }
    }),

  /**
   * Create a new pool (founder only)
   */
  create: protectedProcedure
    .input(createPoolSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify user is founder
      const project = await ctx.prisma.project.findUnique({
        where: { id: input.projectId },
        select: { founderId: true },
      })

      if (!project || project.founderId !== ctx.user.id) {
        throw userError('FORBIDDEN', 'Only the project founder can create pools')
      }

      // Validate required fields based on pool type
      if (input.poolType === PoolType.PROFIT_SHARE) {
        if (!input.poolPercentage) {
          throw userError('BAD_REQUEST', 'Profit share percentage is required')
        }
        if (!input.payoutFrequency) {
          throw userError('BAD_REQUEST', 'Payout frequency is required')
        }
        if (!input.commitmentMonths) {
          throw userError('BAD_REQUEST', 'Commitment period is required')
        }
      } else if (input.poolType === PoolType.FIXED_BUDGET) {
        if (!input.budgetCents) {
          throw userError('BAD_REQUEST', 'Budget is required for FIXED_BUDGET pool type')
        }
      }

      // If setting as default, unset other defaults
      if (input.isDefault) {
        await ctx.prisma.rewardPool.updateMany({
          where: { projectId: input.projectId, isDefault: true },
          data: { isDefault: false },
        })
      }

      // Calculate commitment end date for PROFIT_SHARE
      let commitmentEndsAt: Date | undefined
      if (input.poolType === PoolType.PROFIT_SHARE && input.commitmentMonths) {
        commitmentEndsAt = new Date()
        commitmentEndsAt.setMonth(
          commitmentEndsAt.getMonth() + input.commitmentMonths,
        )
      }

      const pool = await ctx.prisma.rewardPool.create({
        data: {
          projectId: input.projectId,
          name: input.name,
          poolType: input.poolType,
          isDefault: input.isDefault ?? false,
          status: PoolStatus.ACTIVE,
          // PROFIT_SHARE fields
          poolPercentage:
            input.poolType === PoolType.PROFIT_SHARE
              ? input.poolPercentage
              : null,
          poolCapacity: input.poolCapacity ?? 1000,
          payoutFrequency:
            input.poolType === PoolType.PROFIT_SHARE
              ? input.payoutFrequency
              : null,
          profitBasis: input.profitBasis ?? 'NET_PROFIT',
          commitmentMonths:
            input.poolType === PoolType.PROFIT_SHARE
              ? input.commitmentMonths
              : null,
          commitmentEndsAt,
          // FIXED_BUDGET fields
          budgetCents:
            input.poolType !== PoolType.PROFIT_SHARE ? input.budgetCents : null,
          spentCents: 0,
        },
      })

      return serializePool(pool)
    }),

  /**
   * Update a pool (founder only)
   */
  update: protectedProcedure
    .input(updatePoolSchema)
    .mutation(async ({ ctx, input }) => {
      const pool = await ctx.prisma.rewardPool.findUnique({
        where: { id: input.id },
        include: {
          project: { select: { founderId: true } },
          _count: { select: { bounties: { where: { claims: { some: {} } } } } },
        },
      })

      if (!pool) {
        throw userError('NOT_FOUND', 'Pool not found')
      }

      if (pool.project.founderId !== ctx.user.id) {
        throw userError('FORBIDDEN', 'Only the project founder can update pools')
      }

      // Check if pool is locked (has claimed bounties)
      const isLocked = pool._count.bounties > 0
      if (isLocked) {
        // Only allow certain fields to be updated on locked pools
        const lockedFields = [
          'poolPercentage',
          'payoutFrequency',
          'profitBasis',
          'commitmentMonths',
        ] as const
        for (const field of lockedFields) {
          if (input[field] !== undefined && input[field] !== pool[field]) {
            throw userError(
              'BAD_REQUEST',
              `Cannot change ${field} after bounties have been claimed`,
            )
          }
        }
      }

      // If setting as default, unset other defaults
      if (input.isDefault && !pool.isDefault) {
        await ctx.prisma.rewardPool.updateMany({
          where: { projectId: pool.projectId, isDefault: true },
          data: { isDefault: false },
        })
      }

      // Calculate new commitment end date if commitmentMonths changed
      let commitmentEndsAt: Date | undefined
      if (
        input.commitmentMonths &&
        input.commitmentMonths !== pool.commitmentMonths
      ) {
        commitmentEndsAt = new Date()
        commitmentEndsAt.setMonth(
          commitmentEndsAt.getMonth() + input.commitmentMonths,
        )
      }

      const { id, ...data } = input
      const updatedPool = await ctx.prisma.rewardPool.update({
        where: { id },
        data: {
          ...data,
          ...(commitmentEndsAt && { commitmentEndsAt }),
        },
      })

      return serializePool(updatedPool)
    }),

  /**
   * Set a pool as the default for the project (founder only)
   */
  setDefault: protectedProcedure
    .input(z.object({ id: nanoId() }))
    .mutation(async ({ ctx, input }) => {
      const pool = await ctx.prisma.rewardPool.findUnique({
        where: { id: input.id },
        include: { project: { select: { founderId: true } } },
      })

      if (!pool) {
        throw userError('NOT_FOUND', 'Pool not found')
      }

      if (pool.project.founderId !== ctx.user.id) {
        throw userError(
          'FORBIDDEN',
          'Only the project founder can set the default pool',
        )
      }

      // Unset current default and set new one
      await ctx.prisma.$transaction([
        ctx.prisma.rewardPool.updateMany({
          where: { projectId: pool.projectId, isDefault: true },
          data: { isDefault: false },
        }),
        ctx.prisma.rewardPool.update({
          where: { id: input.id },
          data: { isDefault: true },
        }),
      ])

      return { success: true }
    }),

  /**
   * Delete a pool (founder only, only if no bounties)
   */
  delete: protectedProcedure
    .input(z.object({ id: nanoId() }))
    .mutation(async ({ ctx, input }) => {
      const pool = await ctx.prisma.rewardPool.findUnique({
        where: { id: input.id },
        include: {
          project: { select: { founderId: true } },
          _count: { select: { bounties: true, payouts: true } },
        },
      })

      if (!pool) {
        throw userError('NOT_FOUND', 'Pool not found')
      }

      if (pool.project.founderId !== ctx.user.id) {
        throw userError('FORBIDDEN', 'Only the project founder can delete pools')
      }

      if (pool._count.bounties > 0 || pool._count.payouts > 0) {
        throw userError(
          'BAD_REQUEST',
          'Cannot delete a pool that has bounties or payouts',
        )
      }

      if (pool.isDefault) {
        throw userError(
          'BAD_REQUEST',
          'Cannot delete the default pool. Set another pool as default first.',
        )
      }

      await ctx.prisma.rewardPool.delete({ where: { id: input.id } })

      return { success: true }
    }),
})
