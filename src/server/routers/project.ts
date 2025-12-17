import {
  BountyStatus,
  CommitmentMonths,
  DEFAULT_PLATFORM_FEE_PERCENTAGE,
  PayoutFrequency,
  PayoutVisibility,
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

      return ctx.prisma.project.findMany({
        where: { founderId: ctx.user.id },
        orderBy,
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
        throw userError('BAD_REQUEST', validation.error || 'Invalid slug')
      }

      // Check if slug is available
      const available = await isProjectSlugAvailable(input.slug, { userEmail })
      if (!available) {
        throw userError('CONFLICT', 'This slug is already taken')
      }

      // Validate project key
      const keyValidation = validateProjectKey(input.projectKey)
      if (!keyValidation.isValid) {
        throw userError(
          'BAD_REQUEST',
          keyValidation.error || 'Invalid project key',
        )
      }

      // Check key availability (unique per founder)
      const keyAvailable = await isProjectKeyAvailable(
        ctx.user.id,
        input.projectKey,
      )
      if (!keyAvailable) {
        throw userError(
          'CONFLICT',
          'This project key is already used by one of your projects',
        )
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
        throw userError('NOT_FOUND', 'Project not found')
      }

      if (project.founderId !== ctx.user.id) {
        throw userError('FORBIDDEN', 'You do not own this project')
      }

      // If slug is being changed, validate it
      if (slug && slug !== project.slug) {
        const validation = validateProjectSlug(slug, userEmail)
        if (!validation.isValid) {
          throw userError('BAD_REQUEST', validation.error || 'Invalid slug')
        }

        const available = await isProjectSlugAvailable(slug, { userEmail })
        if (!available) {
          throw userError('CONFLICT', 'This slug is already taken')
        }
      }

      // If project key is being changed, validate and ensure it's unique for this founder
      if (projectKey) {
        const keyValidation = validateProjectKey(projectKey)
        if (!keyValidation.isValid) {
          throw userError(
            'BAD_REQUEST',
            keyValidation.error || 'Invalid project key',
          )
        }

        const keyAvailable = await isProjectKeyAvailable(
          ctx.user.id,
          projectKey,
          {
            excludeProjectId: id,
          },
        )
        if (!keyAvailable) {
          throw userError(
            'CONFLICT',
            'This project key is already used by one of your projects',
          )
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
          throw userError(
            'FORBIDDEN',
            'Cannot update reward pool settings when bounties have been claimed or completed',
          )
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
        poolCapacity: project.rewardPool.poolCapacity,
        allocatedPoints,
        earnedPoints,
        availablePoints: project.rewardPool.poolCapacity - allocatedPoints,
        expansionEvents: project.rewardPool.expansionEvents,
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
        include: { rewardPool: true },
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

      if (!project.rewardPool) {
        throw userError('BAD_REQUEST', 'Project has no reward pool')
      }

      const previousCapacity = project.rewardPool.poolCapacity

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
