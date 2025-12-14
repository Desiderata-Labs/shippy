import {
  BountyStatus,
  CommitmentMonths,
  DEFAULT_PLATFORM_FEE_PERCENTAGE,
  PayoutFrequency,
  PayoutVisibility,
  ProfitBasis,
} from '@/lib/db/types'
import { nanoId } from '@/lib/nanoid/schema'
import { isProjectKeyAvailable } from '@/lib/project-key/server'
import {
  normalizeProjectKey,
  validateProjectKey,
} from '@/lib/project-key/shared'
import {
  isProjectSlugAvailable,
  validateProjectSlug,
} from '@/lib/project-slug/server'
import { protectedProcedure, publicProcedure, router } from '@/server/trpc'
import { TRPCError } from '@trpc/server'
import { z } from 'zod/v4'

// Validation schemas
const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(1)
    .max(50)
    .regex(
      /^[a-z0-9-]+$/,
      'Slug must be lowercase letters, numbers, and hyphens',
    ),
  projectKey: z
    .string()
    .min(1)
    .max(10)
    .transform((v) => normalizeProjectKey(v)),
  tagline: z.string().max(200).optional(),
  description: z.string().optional(),
  logoUrl: z.string().url().optional(),
  websiteUrl: z.string().url().optional(),
  discordUrl: z.string().url().optional(),
  // Reward pool config
  poolPercentage: z.number().int().min(1).max(100),
  payoutFrequency: z.enum([PayoutFrequency.MONTHLY, PayoutFrequency.QUARTERLY]),
  profitBasis: z
    .enum([ProfitBasis.NET_PROFIT, ProfitBasis.GROSS_REVENUE])
    .optional(),
  commitmentMonths: z
    .enum([
      CommitmentMonths.SIX_MONTHS,
      CommitmentMonths.ONE_YEAR,
      CommitmentMonths.TWO_YEARS,
      CommitmentMonths.THREE_YEARS,
      CommitmentMonths.FIVE_YEARS,
      CommitmentMonths.TEN_YEARS,
      CommitmentMonths.FOREVER,
    ])
    .transform(Number),
  payoutVisibility: z
    .enum([PayoutVisibility.PRIVATE, PayoutVisibility.PUBLIC])
    .optional()
    .default(PayoutVisibility.PRIVATE),
})

const updateProjectSchema = z.object({
  id: nanoId(),
  name: z.string().min(1).max(100).optional(),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(
      /^[a-z0-9-]+$/,
      'Slug must be lowercase letters, numbers, and hyphens',
    )
    .optional(),
  projectKey: z
    .string()
    .min(1)
    .max(10)
    .transform((v) => normalizeProjectKey(v))
    .optional(),
  tagline: z.string().max(200).optional(),
  description: z.string().optional(),
  logoUrl: z.string().url().optional().nullable(),
  websiteUrl: z.string().url().optional().nullable(),
  discordUrl: z.string().url().optional().nullable(),
  // Reward pool config (optional - only when no claimed/completed bounties)
  poolPercentage: z.number().int().min(1).max(100).optional(),
  payoutFrequency: z
    .enum([PayoutFrequency.MONTHLY, PayoutFrequency.QUARTERLY])
    .optional(),
  commitmentMonths: z
    .enum([
      CommitmentMonths.SIX_MONTHS,
      CommitmentMonths.ONE_YEAR,
      CommitmentMonths.TWO_YEARS,
      CommitmentMonths.THREE_YEARS,
      CommitmentMonths.FIVE_YEARS,
      CommitmentMonths.TEN_YEARS,
      CommitmentMonths.FOREVER,
    ])
    .transform(Number)
    .optional(),
  payoutVisibility: z
    .enum([PayoutVisibility.PRIVATE, PayoutVisibility.PUBLIC])
    .optional(),
})

export const projectRouter = router({
  /**
   * Check if a project slug is available
   */
  checkSlugAvailable: publicProcedure
    .input(
      z.object({
        slug: z.string().min(1),
      }),
    )
    .query(async ({ ctx, input }) => {
      const normalizedSlug = input.slug.toLowerCase().trim()
      const userEmail = ctx.user?.email

      // Validate format first (admins can use reserved slugs)
      const validation = validateProjectSlug(normalizedSlug, userEmail)
      if (!validation.isValid) {
        return {
          available: false,
          error: validation.error,
        }
      }

      // Check database availability
      const available = await isProjectSlugAvailable(normalizedSlug, {
        userEmail,
      })

      return {
        available,
        error: available ? undefined : 'This slug is already taken',
      }
    }),

  /**
   * Check if a project key (3-letter prefix) is available for the current founder
   */
  checkProjectKeyAvailable: protectedProcedure
    .input(
      z.object({
        projectKey: z.string().min(1),
        excludeProjectId: nanoId().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const normalized = normalizeProjectKey(input.projectKey)

      const validation = validateProjectKey(normalized)
      if (!validation.isValid) {
        return {
          available: false,
          error: validation.error,
        }
      }

      const available = await isProjectKeyAvailable(ctx.user.id, normalized, {
        excludeProjectId: input.excludeProjectId,
      })

      return {
        available,
        error: available
          ? undefined
          : 'This project key is already used by one of your projects',
      }
    }),

  /**
   * Get a project by slug (public)
   */
  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const project = await ctx.prisma.project.findUnique({
        where: { slug: input.slug },
        include: {
          founder: {
            select: { id: true, name: true, image: true },
          },
          rewardPool: true,
          bounties: {
            // Always include past bounties (COMPLETED/CLOSED), not just active ones.
            orderBy: [{ createdAt: 'desc' }],
            include: {
              labels: {
                include: { label: true },
              },
            },
          },
          _count: {
            select: {
              bounties: true,
              payouts: true,
            },
          },
        },
      })

      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' })
      }

      // Only return public projects or projects owned by the current user
      if (!project.isPublic && project.founderId !== ctx.user?.id) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' })
      }

      // Check if reward pool can be edited (no claimed or completed bounties)
      const hasClaimedOrCompletedBounties = await ctx.prisma.bounty.count({
        where: {
          projectId: project.id,
          status: {
            in: [BountyStatus.CLAIMED, BountyStatus.COMPLETED],
          },
        },
      })

      return {
        ...project,
        canEditRewardPool: hasClaimedOrCompletedBounties === 0,
      }
    }),

  /**
   * List public projects for discover page
   */
  discover: publicProcedure
    .input(
      z.object({
        cursor: nanoId().optional(),
        limit: z.number().int().min(1).max(50).default(20),
        sortBy: z
          .enum(['newest', 'totalPaidOut', 'openBounties'])
          .default('newest'),
        hasOpenBounties: z.boolean().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { cursor, limit, hasOpenBounties } = input

      const projects = await ctx.prisma.project.findMany({
        where: {
          isPublic: true,
          ...(hasOpenBounties && {
            bounties: { some: { status: BountyStatus.OPEN } },
          }),
        },
        orderBy: { createdAt: 'desc' },
        take: limit + 1, // Get one extra to check for more
        cursor: cursor ? { id: cursor } : undefined,
        include: {
          founder: {
            select: { id: true, name: true, image: true },
          },
          rewardPool: true,
          _count: {
            select: {
              bounties: { where: { status: BountyStatus.OPEN } },
            },
          },
        },
      })

      let nextCursor: string | undefined
      if (projects.length > limit) {
        const nextItem = projects.pop()
        nextCursor = nextItem?.id
      }

      return {
        projects,
        nextCursor,
      }
    }),

  /**
   * Get projects owned by the current user
   */
  myProjects: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.project.findMany({
      where: { founderId: ctx.user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        founder: {
          select: { id: true, name: true, image: true },
        },
        rewardPool: true,
        _count: {
          select: {
            bounties: true,
          },
        },
      },
    })
  }),

  /**
   * Create a new project
   */
  create: protectedProcedure
    .input(createProjectSchema)
    .mutation(async ({ ctx, input }) => {
      const userEmail = ctx.user.email

      // Validate slug format (admins can use reserved slugs)
      const validation = validateProjectSlug(input.slug, userEmail)
      if (!validation.isValid) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: validation.error || 'Invalid slug',
        })
      }

      // Check if slug is available
      const available = await isProjectSlugAvailable(input.slug, { userEmail })
      if (!available) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'This slug is already taken',
        })
      }

      // Validate project key
      const keyValidation = validateProjectKey(input.projectKey)
      if (!keyValidation.isValid) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: keyValidation.error || 'Invalid project key',
        })
      }

      // Check key availability (unique per founder)
      const keyAvailable = await isProjectKeyAvailable(
        ctx.user.id,
        input.projectKey,
      )
      if (!keyAvailable) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'This project key is already used by one of your projects',
        })
      }

      // Calculate commitment end date
      const commitmentEndsAt = new Date()
      commitmentEndsAt.setMonth(
        commitmentEndsAt.getMonth() + input.commitmentMonths,
      )

      // Create project with reward pool
      const project = await ctx.prisma.project.create({
        data: {
          name: input.name,
          slug: input.slug,
          projectKey: input.projectKey,
          tagline: input.tagline,
          description: input.description,
          logoUrl: input.logoUrl,
          websiteUrl: input.websiteUrl,
          discordUrl: input.discordUrl,
          payoutVisibility: input.payoutVisibility,
          founderId: ctx.user.id,
          rewardPool: {
            create: {
              poolPercentage: input.poolPercentage,
              payoutFrequency: input.payoutFrequency,
              profitBasis: input.profitBasis ?? ProfitBasis.NET_PROFIT,
              commitmentMonths: input.commitmentMonths,
              commitmentEndsAt,
              platformFeePercentage: DEFAULT_PLATFORM_FEE_PERCENTAGE,
            },
          },
        },
        include: {
          rewardPool: true,
        },
      })

      return project
    }),

  /**
   * Update a project (founder only)
   */
  update: protectedProcedure
    .input(updateProjectSchema)
    .mutation(async ({ ctx, input }) => {
      const {
        id,
        slug,
        projectKey,
        poolPercentage,
        payoutFrequency,
        commitmentMonths,
        payoutVisibility,
        ...projectData
      } = input
      const userEmail = ctx.user.email

      // Verify ownership
      const project = await ctx.prisma.project.findUnique({
        where: { id },
        select: { founderId: true, slug: true },
      })

      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' })
      }

      if (project.founderId !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not own this project',
        })
      }

      // If slug is being changed, validate it
      if (slug && slug !== project.slug) {
        const validation = validateProjectSlug(slug, userEmail)
        if (!validation.isValid) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: validation.error || 'Invalid slug',
          })
        }

        const available = await isProjectSlugAvailable(slug, { userEmail })
        if (!available) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'This slug is already taken',
          })
        }
      }

      // If project key is being changed, validate and ensure it's unique for this founder
      if (projectKey) {
        const keyValidation = validateProjectKey(projectKey)
        if (!keyValidation.isValid) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: keyValidation.error || 'Invalid project key',
          })
        }

        const keyAvailable = await isProjectKeyAvailable(
          ctx.user.id,
          projectKey,
          {
            excludeProjectId: id,
          },
        )
        if (!keyAvailable) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'This project key is already used by one of your projects',
          })
        }
      }

      // Check if trying to update reward pool settings
      const hasRewardPoolUpdates =
        poolPercentage !== undefined ||
        payoutFrequency !== undefined ||
        commitmentMonths !== undefined

      if (hasRewardPoolUpdates) {
        // Check if there are any claimed or completed bounties
        const claimedOrCompletedCount = await ctx.prisma.bounty.count({
          where: {
            projectId: id,
            status: {
              in: [BountyStatus.CLAIMED, BountyStatus.COMPLETED],
            },
          },
        })

        if (claimedOrCompletedCount > 0) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message:
              'Cannot update reward pool settings when bounties have been claimed or completed',
          })
        }
      }

      // Build reward pool update data
      const rewardPoolUpdate: {
        poolPercentage?: number
        payoutFrequency?: string
        commitmentMonths?: number
        commitmentEndsAt?: Date
      } = {}

      if (poolPercentage !== undefined) {
        rewardPoolUpdate.poolPercentage = poolPercentage
      }
      if (payoutFrequency !== undefined) {
        rewardPoolUpdate.payoutFrequency = payoutFrequency
      }
      if (commitmentMonths !== undefined) {
        rewardPoolUpdate.commitmentMonths = commitmentMonths
        // Recalculate commitment end date from now
        const commitmentEndsAt = new Date()
        commitmentEndsAt.setMonth(
          commitmentEndsAt.getMonth() + commitmentMonths,
        )
        rewardPoolUpdate.commitmentEndsAt = commitmentEndsAt
      }

      return ctx.prisma.project.update({
        where: { id },
        data: {
          ...projectData,
          ...(slug && slug !== project.slug ? { slug } : {}),
          ...(projectKey ? { projectKey } : {}),
          ...(payoutVisibility ? { payoutVisibility } : {}),
          ...(Object.keys(rewardPoolUpdate).length > 0
            ? { rewardPool: { update: rewardPoolUpdate } }
            : {}),
        },
        include: { rewardPool: true },
      })
    }),

  /**
   * Get pool capacity stats for a project
   */
  getPoolStats: publicProcedure
    .input(z.object({ projectId: nanoId() }))
    .query(async ({ ctx, input }) => {
      const project = await ctx.prisma.project.findUnique({
        where: { id: input.projectId },
        include: {
          rewardPool: {
            include: {
              expansionEvents: {
                orderBy: { createdAt: 'desc' },
              },
            },
          },
          bounties: {
            where: {
              status: { in: [BountyStatus.OPEN, BountyStatus.CLAIMED] },
            },
            select: { points: true },
          },
        },
      })

      if (!project || !project.rewardPool) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project or reward pool not found',
        })
      }

      // Calculate allocated points (sum of all active bounty points)
      const allocatedPoints = project.bounties.reduce(
        (sum, b) => sum + b.points,
        0,
      )

      // Get earned points (from approved submissions)
      const earnedResult = await ctx.prisma.submission.aggregate({
        where: {
          bounty: { projectId: input.projectId },
          status: 'APPROVED',
          pointsAwarded: { not: null },
        },
        _sum: { pointsAwarded: true },
      })
      const earnedPoints = earnedResult._sum.pointsAwarded ?? 0

      return {
        poolCapacity: project.rewardPool.poolCapacity,
        allocatedPoints,
        earnedPoints,
        availablePoints: project.rewardPool.poolCapacity - allocatedPoints,
        expansionEvents: project.rewardPool.expansionEvents,
      }
    }),

  /**
   * Expand pool capacity (founder only)
   */
  expandPoolCapacity: protectedProcedure
    .input(
      z.object({
        projectId: nanoId(),
        newCapacity: z.number().int().min(1),
        reason: z.string().min(1).max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const project = await ctx.prisma.project.findUnique({
        where: { id: input.projectId },
        include: { rewardPool: true },
      })

      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' })
      }

      if (project.founderId !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only the founder can expand pool capacity',
        })
      }

      if (!project.rewardPool) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Project has no reward pool',
        })
      }

      const previousCapacity = project.rewardPool.poolCapacity

      if (input.newCapacity <= previousCapacity) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'New capacity must be greater than current capacity',
        })
      }

      // Calculate dilution percentage
      const dilutionPercent =
        ((input.newCapacity - previousCapacity) / previousCapacity) * 100

      // Update capacity and create expansion event
      const [updatedPool] = await ctx.prisma.$transaction([
        ctx.prisma.rewardPool.update({
          where: { id: project.rewardPool.id },
          data: { poolCapacity: input.newCapacity },
        }),
        ctx.prisma.poolExpansionEvent.create({
          data: {
            rewardPoolId: project.rewardPool.id,
            previousCapacity,
            newCapacity: input.newCapacity,
            reason: input.reason,
            dilutionPercent,
          },
        }),
      ])

      return updatedPool
    }),
})
