import {
  BountyStatus,
  CommitmentMonths,
  PayoutFrequency,
  PayoutVisibility,
  PoolType,
  ProfitBasis,
  SubmissionStatus,
} from '@/lib/db/types'
import { nanoId } from '@/lib/nanoid/zod'
import { isProjectKeyAvailable } from '@/lib/project-key/server'
import {
  normalizeProjectKey,
  validateProjectKey,
} from '@/lib/project-key/shared'
import {
  isProjectSlugAvailable,
  validateProjectSlug,
} from '@/lib/project-slug/server'
import {
  createProject,
  updateProject,
  updateProjectLogo,
} from '@/server/services/project'
import {
  protectedProcedure,
  publicProcedure,
  router,
  userError,
} from '@/server/trpc'
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
  // Pool type (defaults to PROFIT_SHARE for backwards compatibility)
  poolType: z.enum(PoolType).optional().default(PoolType.PROFIT_SHARE),
  // PROFIT_SHARE pool config (required if poolType is PROFIT_SHARE)
  poolPercentage: z.number().int().min(1).max(100).optional(),
  payoutFrequency: z
    .enum([PayoutFrequency.MONTHLY, PayoutFrequency.QUARTERLY])
    .optional(),
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
    .transform(Number)
    .optional(),
  // FIXED_BUDGET pool config
  budgetCents: z.number().int().min(100).optional(), // At least $1
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
          rewardPools: {
            where: { isDefault: true },
            take: 1,
          },
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
        throw userError('NOT_FOUND', 'Project not found')
      }

      // Only return public projects or projects owned by the current user
      if (!project.isPublic && project.founderId !== ctx.user?.id) {
        throw userError('NOT_FOUND', 'Project not found')
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

      // Extract default pool for backward compatibility
      const rewardPool = project.rewardPools[0] ?? null

      return {
        ...project,
        rewardPool, // Provide single pool for backward compatibility
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
        sortBy: z.enum(['newest', 'mostBounties']).default('newest'),
        hasOpenBounties: z.boolean().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { cursor, limit, sortBy, hasOpenBounties } = input

      // Build orderBy based on sortBy
      const orderBy =
        sortBy === 'mostBounties'
          ? [
              { bounties: { _count: 'desc' as const } },
              { createdAt: 'desc' as const },
            ]
          : [{ createdAt: 'desc' as const }]

      const projects = await ctx.prisma.project.findMany({
        where: {
          isPublic: true,
          ...(hasOpenBounties && {
            bounties: { some: { status: BountyStatus.OPEN } },
          }),
        },
        orderBy,
        take: limit + 1, // Get one extra to check for more
        cursor: cursor ? { id: cursor } : undefined,
        include: {
          founder: {
            select: { id: true, name: true, image: true },
          },
          rewardPools: {
            where: { isDefault: true },
            take: 1,
          },
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

      // Add backward-compatible rewardPool property
      const projectsWithPool = projects.map((p) => ({
        ...p,
        rewardPool: p.rewardPools[0] ?? null,
      }))

      return {
        projects: projectsWithPool,
        nextCursor,
      }
    }),

  /**
   * Get projects owned by the current user
   */
  myProjects: protectedProcedure
    .input(
      z
        .object({
          sortBy: z
            .enum(['mostBounties', 'alphabetical', 'newest'])
            .default('mostBounties'),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const sortBy = input?.sortBy ?? 'mostBounties'

      // Build orderBy based on sortBy
      let orderBy
      switch (sortBy) {
        case 'mostBounties':
          orderBy = [
            { bounties: { _count: 'desc' as const } },
            { createdAt: 'desc' as const },
          ]
          break
        case 'alphabetical':
          orderBy = [{ name: 'asc' as const }]
          break
        case 'newest':
        default:
          orderBy = [{ createdAt: 'desc' as const }]
      }

      const projects = await ctx.prisma.project.findMany({
        where: { founderId: ctx.user.id },
        orderBy,
        include: {
          founder: {
            select: { id: true, name: true, image: true },
          },
          rewardPools: {
            where: { isDefault: true },
            take: 1,
          },
          _count: {
            select: {
              bounties: { where: { status: BountyStatus.OPEN } },
            },
          },
        },
      })

      // Add backward-compatible rewardPool property
      return projects.map((p) => ({
        ...p,
        rewardPool: p.rewardPools[0] ?? null,
      }))
    }),

  /**
   * Create a new project
   */
  create: protectedProcedure
    .input(createProjectSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await createProject({
        prisma: ctx.prisma,
        userId: ctx.user.id,
        userEmail: ctx.user.email,
        name: input.name,
        slug: input.slug,
        projectKey: input.projectKey,
        tagline: input.tagline,
        description: input.description,
        logoUrl: input.logoUrl,
        websiteUrl: input.websiteUrl,
        discordUrl: input.discordUrl,
        poolType: input.poolType,
        poolPercentage: input.poolPercentage,
        payoutFrequency: input.payoutFrequency,
        profitBasis: input.profitBasis,
        commitmentMonths: input.commitmentMonths,
        budgetCents: input.budgetCents,
        payoutVisibility: input.payoutVisibility,
      })

      if (!result.success) {
        const errorCodeMap = {
          INVALID_SLUG: 'BAD_REQUEST',
          SLUG_TAKEN: 'CONFLICT',
          INVALID_PROJECT_KEY: 'BAD_REQUEST',
          PROJECT_KEY_TAKEN: 'CONFLICT',
        } as const
        throw userError(errorCodeMap[result.code], result.message)
      }

      return result.project
    }),

  /**
   * Update project logo (founder only) - used for auto-save on upload
   */
  updateLogo: protectedProcedure
    .input(
      z.object({
        id: nanoId(),
        logoUrl: z.string().url().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await updateProjectLogo({
        prisma: ctx.prisma,
        projectId: input.id,
        userId: ctx.user.id,
        logoUrl: input.logoUrl,
      })

      if (!result.success) {
        const errorCodeMap = {
          NOT_FOUND: 'NOT_FOUND',
          FORBIDDEN: 'FORBIDDEN',
        } as const
        throw userError(errorCodeMap[result.code], result.message)
      }

      return result.project
    }),

  /**
   * Update a project (founder only)
   */
  update: protectedProcedure
    .input(updateProjectSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await updateProject({
        prisma: ctx.prisma,
        projectId: input.id,
        userId: ctx.user.id,
        userEmail: ctx.user.email,
        data: {
          name: input.name,
          slug: input.slug,
          projectKey: input.projectKey,
          tagline: input.tagline,
          description: input.description,
          logoUrl: input.logoUrl,
          websiteUrl: input.websiteUrl,
          discordUrl: input.discordUrl,
          poolPercentage: input.poolPercentage,
          payoutFrequency: input.payoutFrequency,
          commitmentMonths: input.commitmentMonths,
          payoutVisibility: input.payoutVisibility,
        },
      })

      if (!result.success) {
        const errorCodeMap = {
          NOT_FOUND: 'NOT_FOUND',
          FORBIDDEN: 'FORBIDDEN',
          INVALID_SLUG: 'BAD_REQUEST',
          SLUG_TAKEN: 'CONFLICT',
          INVALID_PROJECT_KEY: 'BAD_REQUEST',
          PROJECT_KEY_TAKEN: 'CONFLICT',
          REWARD_POOL_LOCKED: 'FORBIDDEN',
          NO_CHANGES: 'BAD_REQUEST',
        } as const
        throw userError(errorCodeMap[result.code], result.message)
      }

      return result.project
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
          rewardPools: {
            where: { isDefault: true },
            take: 1,
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

      const rewardPool = project?.rewardPools[0]
      if (!project || !rewardPool) {
        throw userError('NOT_FOUND', 'Project or reward pool not found')
      }

      // Calculate allocated points (sum of all active bounty points)
      // Backlog bounties (points = null) don't count toward allocation
      const allocatedPoints = project.bounties.reduce(
        (sum, b) => sum + (b.points ?? 0),
        0,
      )

      // Get earned points (from approved submissions)
      const earnedResult = await ctx.prisma.submission.aggregate({
        where: {
          bounty: { projectId: input.projectId },
          status: SubmissionStatus.APPROVED,
          pointsAwarded: { not: null },
        },
        _sum: { pointsAwarded: true },
      })
      const earnedPoints = earnedResult._sum.pointsAwarded ?? 0

      return {
        poolCapacity: rewardPool.poolCapacity,
        allocatedPoints,
        earnedPoints,
        availablePoints: rewardPool.poolCapacity - allocatedPoints,
        expansionEvents: rewardPool.expansionEvents,
      }
    }),

  /**
   * Get GitHub integration status for a project
   */
  getGitHubConnection: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const project = await ctx.prisma.project.findUnique({
        where: { slug: input.slug },
        select: {
          id: true,
          founderId: true,
          githubConnection: true,
        },
      })

      if (!project) {
        throw userError('NOT_FOUND', 'Project not found')
      }

      if (project.founderId !== ctx.user.id) {
        throw userError('FORBIDDEN', 'You do not own this project')
      }

      return {
        projectId: project.id,
        connection: project.githubConnection,
      }
    }),

  /**
   * Disconnect GitHub from a project
   * If no other projects use the same installation, also uninstalls from GitHub
   */
  disconnectGitHub: protectedProcedure
    .input(z.object({ projectId: nanoId() }))
    .mutation(async ({ ctx, input }) => {
      const project = await ctx.prisma.project.findUnique({
        where: { id: input.projectId },
        select: { founderId: true, githubConnection: true },
      })

      if (!project) {
        throw userError('NOT_FOUND', 'Project not found')
      }

      if (project.founderId !== ctx.user.id) {
        throw userError('FORBIDDEN', 'You do not own this project')
      }

      if (!project.githubConnection) {
        throw userError(
          'BAD_REQUEST',
          'GitHub is not connected to this project',
        )
      }

      const { installationId } = project.githubConnection

      // Delete the database record first
      await ctx.prisma.gitHubConnection.delete({
        where: { projectId: input.projectId },
      })

      // Check if any other projects still use this installation
      const otherConnections = await ctx.prisma.gitHubConnection.count({
        where: { installationId },
      })

      // If no other projects use this installation, uninstall from GitHub
      if (otherConnections === 0) {
        try {
          const { getAppOctokit } = await import('@/lib/github/server')
          const octokit = getAppOctokit()
          await octokit.apps.deleteInstallation({
            installation_id: installationId,
          })
        } catch (error) {
          // Log but don't fail - the local disconnect succeeded
          // The installation may have already been removed from GitHub
          console.error('Failed to uninstall GitHub App:', error)
        }
      }

      return { success: true }
    }),

  /**
   * List repos accessible to a GitHub installation (for repo picker)
   */
  listGitHubRepos: protectedProcedure
    .input(z.object({ installationId: z.number() }))
    .query(async ({ input }) => {
      // Dynamic import to avoid loading GitHub deps on every request
      const { getInstallationOctokit } = await import('@/lib/github/server')
      const octokit = await getInstallationOctokit(input.installationId)
      const { data } = await octokit.apps.listReposAccessibleToInstallation({
        per_page: 100,
      })
      return data.repositories.map((repo) => ({
        id: repo.id,
        fullName: repo.full_name,
        private: repo.private,
      }))
    }),

  /**
   * Link a specific repo to a project
   */
  linkGitHubRepo: protectedProcedure
    .input(
      z.object({
        projectId: nanoId(),
        installationId: z.number(),
        repoId: z.number(),
        repoFullName: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const project = await ctx.prisma.project.findUnique({
        where: { id: input.projectId },
        select: { founderId: true },
      })

      if (!project) {
        throw userError('NOT_FOUND', 'Project not found')
      }

      if (project.founderId !== ctx.user.id) {
        throw userError('FORBIDDEN', 'You do not own this project')
      }

      return ctx.prisma.gitHubConnection.upsert({
        where: { projectId: input.projectId },
        create: {
          projectId: input.projectId,
          installationId: input.installationId,
          repoId: input.repoId,
          repoFullName: input.repoFullName,
        },
        update: {
          installationId: input.installationId,
          repoId: input.repoId,
          repoFullName: input.repoFullName,
        },
      })
    }),

  /**
   * Update GitHub connection settings (e.g., auto-approve)
   */
  updateGitHubSettings: protectedProcedure
    .input(
      z.object({
        projectId: nanoId(),
        autoApproveOnMerge: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const project = await ctx.prisma.project.findUnique({
        where: { id: input.projectId },
        select: { founderId: true, githubConnection: true },
      })

      if (!project) {
        throw userError('NOT_FOUND', 'Project not found')
      }

      if (project.founderId !== ctx.user.id) {
        throw userError('FORBIDDEN', 'You do not own this project')
      }

      if (!project.githubConnection) {
        throw userError(
          'BAD_REQUEST',
          'GitHub is not connected to this project',
        )
      }

      return ctx.prisma.gitHubConnection.update({
        where: { projectId: input.projectId },
        data: { autoApproveOnMerge: input.autoApproveOnMerge },
      })
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
        include: {
          rewardPools: {
            where: { isDefault: true },
            take: 1,
          },
        },
      })

      if (!project) {
        throw userError('NOT_FOUND', 'Project not found')
      }

      if (project.founderId !== ctx.user.id) {
        throw userError(
          'FORBIDDEN',
          'Only the founder can expand pool capacity',
        )
      }

      const rewardPool = project.rewardPools[0]
      if (!rewardPool) {
        throw userError('BAD_REQUEST', 'Project has no reward pool')
      }

      const previousCapacity = rewardPool.poolCapacity

      if (input.newCapacity <= previousCapacity) {
        throw userError(
          'BAD_REQUEST',
          'New capacity must be greater than current capacity',
        )
      }

      // Calculate dilution percentage
      const dilutionPercent =
        ((input.newCapacity - previousCapacity) / previousCapacity) * 100

      // Update capacity and create expansion event
      const [updatedPool] = await ctx.prisma.$transaction([
        ctx.prisma.rewardPool.update({
          where: { id: rewardPool.id },
          data: { poolCapacity: input.newCapacity },
        }),
        ctx.prisma.poolExpansionEvent.create({
          data: {
            rewardPoolId: rewardPool.id,
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
