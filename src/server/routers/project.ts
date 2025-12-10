import {
  BountyStatus,
  DEFAULT_PLATFORM_FEE_PERCENTAGE,
  PayoutFrequency,
  ProfitBasis,
} from '@/lib/db/types'
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
  commitmentMonths: z.enum(['6', '12', '24', '36']).transform(Number),
})

const updateProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  tagline: z.string().max(200).optional(),
  description: z.string().optional(),
  logoUrl: z.string().url().optional().nullable(),
  websiteUrl: z.string().url().optional().nullable(),
  discordUrl: z.string().url().optional().nullable(),
})

export const projectRouter = router({
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
            where: {
              status: { in: [BountyStatus.OPEN, BountyStatus.CLAIMED] },
            },
            orderBy: { createdAt: 'desc' },
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

      return project
    }),

  /**
   * List public projects for discover page
   */
  discover: publicProcedure
    .input(
      z.object({
        cursor: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(50).default(20),
        sortBy: z
          .enum(['newest', 'totalPaidOut', 'openBounties'])
          .default('newest'),
        hasOpenBounties: z.boolean().optional(),
        tags: z.array(z.string()).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { cursor, limit, hasOpenBounties, tags } = input

      const projects = await ctx.prisma.project.findMany({
        where: {
          isPublic: true,
          ...(hasOpenBounties && {
            bounties: { some: { status: BountyStatus.OPEN } },
          }),
          ...(tags &&
            tags.length > 0 && {
              bounties: { some: { tags: { hasSome: tags } } },
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
        rewardPool: true,
        _count: {
          select: {
            bounties: true,
            payouts: true,
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
      // Check if slug is available
      const existing = await ctx.prisma.project.findUnique({
        where: { slug: input.slug },
      })

      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'This slug is already taken',
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
          tagline: input.tagline,
          description: input.description,
          logoUrl: input.logoUrl,
          websiteUrl: input.websiteUrl,
          discordUrl: input.discordUrl,
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
      const { id, ...data } = input

      // Verify ownership
      const project = await ctx.prisma.project.findUnique({
        where: { id },
        select: { founderId: true },
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

      return ctx.prisma.project.update({
        where: { id },
        data,
        include: { rewardPool: true },
      })
    }),
})
