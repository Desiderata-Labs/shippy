import {
  BountyClaimMode,
  BountyStatus,
  BountyTag,
  ClaimStatus,
  DEFAULT_CLAIM_EXPIRY_DAYS,
} from '@/lib/db/types'
import { protectedProcedure, publicProcedure, router } from '@/server/trpc'
import { TRPCError } from '@trpc/server'
import { z } from 'zod/v4'

// Validation schemas
const createBountySchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  points: z.number().int().min(1),
  tags: z.array(z.nativeEnum(BountyTag)).min(1),
  claimMode: z.nativeEnum(BountyClaimMode).default(BountyClaimMode.SINGLE),
  claimExpiryDays: z
    .number()
    .int()
    .min(1)
    .max(90)
    .default(DEFAULT_CLAIM_EXPIRY_DAYS),
  maxClaims: z.number().int().min(1).optional(),
  evidenceDescription: z.string().optional(),
})

const updateBountySchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).optional(),
  points: z.number().int().min(1).optional(),
  tags: z.array(z.nativeEnum(BountyTag)).min(1).optional(),
  evidenceDescription: z.string().optional().nullable(),
  status: z.nativeEnum(BountyStatus).optional(),
})

export const bountyRouter = router({
  /**
   * Get bounties for a project
   */
  getByProject: publicProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        status: z.nativeEnum(BountyStatus).optional(),
        tags: z.array(z.nativeEnum(BountyTag)).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return ctx.prisma.bounty.findMany({
        where: {
          projectId: input.projectId,
          ...(input.status && { status: input.status }),
          ...(input.tags &&
            input.tags.length > 0 && { tags: { hasSome: input.tags } }),
        },
        orderBy: [{ status: 'asc' }, { points: 'desc' }, { createdAt: 'desc' }],
        include: {
          _count: {
            select: {
              claims: { where: { status: ClaimStatus.ACTIVE } },
              submissions: true,
            },
          },
        },
      })
    }),

  /**
   * Get a single bounty by ID
   */
  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const bounty = await ctx.prisma.bounty.findUnique({
        where: { id: input.id },
        include: {
          project: {
            include: {
              founder: { select: { id: true, name: true, image: true } },
              rewardPool: true,
            },
          },
          claims: {
            where: { status: ClaimStatus.ACTIVE },
            include: {
              user: { select: { id: true, name: true, image: true } },
            },
          },
          submissions: {
            orderBy: { createdAt: 'desc' },
            include: {
              user: { select: { id: true, name: true, image: true } },
              _count: { select: { events: true } },
            },
          },
          _count: {
            select: { submissions: true },
          },
        },
      })

      if (!bounty) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Bounty not found' })
      }

      // Filter submissions based on viewer:
      // - Founder sees all submissions
      // - Contributors only see their own submissions
      const isFounder = bounty.project.founderId === ctx.user?.id
      const filteredSubmissions = isFounder
        ? bounty.submissions
        : bounty.submissions.filter((s) => s.userId === ctx.user?.id)

      return {
        ...bounty,
        submissions: filteredSubmissions,
      }
    }),

  /**
   * Create a bounty (founder only)
   */
  create: protectedProcedure
    .input(createBountySchema)
    .mutation(async ({ ctx, input }) => {
      // Verify project ownership and get pool info
      const project = await ctx.prisma.project.findUnique({
        where: { id: input.projectId },
        include: {
          rewardPool: true,
          bounties: {
            where: {
              status: { in: [BountyStatus.OPEN, BountyStatus.CLAIMED] },
            },
            select: { points: true },
          },
        },
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

      if (!project.rewardPool) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Project does not have a reward pool',
        })
      }

      // Calculate current allocated points and check if we need to expand
      const currentAllocated = project.bounties.reduce(
        (sum, b) => sum + b.points,
        0,
      )
      const newTotalAllocated = currentAllocated + input.points
      const currentCapacity = project.rewardPool.poolCapacity

      // Auto-expand pool capacity if needed
      if (newTotalAllocated > currentCapacity) {
        const dilutionPercent =
          ((newTotalAllocated - currentCapacity) / newTotalAllocated) * 100

        // Use transaction to expand pool and create bounty together
        return ctx.prisma.$transaction(async (tx) => {
          // Expand pool capacity
          await tx.rewardPool.update({
            where: { id: project.rewardPool!.id },
            data: { poolCapacity: newTotalAllocated },
          })

          // Log the expansion event
          await tx.poolExpansionEvent.create({
            data: {
              rewardPoolId: project.rewardPool!.id,
              previousCapacity: currentCapacity,
              newCapacity: newTotalAllocated,
              reason: `Auto-expanded to accommodate bounty: "${input.title}"`,
              dilutionPercent,
            },
          })

          // Create the bounty
          return tx.bounty.create({
            data: {
              projectId: input.projectId,
              title: input.title,
              description: input.description,
              points: input.points,
              tags: input.tags,
              claimMode: input.claimMode,
              claimExpiryDays: input.claimExpiryDays,
              maxClaims: input.maxClaims,
              evidenceDescription: input.evidenceDescription,
            },
          })
        })
      }

      // No expansion needed, just create the bounty
      return ctx.prisma.bounty.create({
        data: {
          projectId: input.projectId,
          title: input.title,
          description: input.description,
          points: input.points,
          tags: input.tags,
          claimMode: input.claimMode,
          claimExpiryDays: input.claimExpiryDays,
          maxClaims: input.maxClaims,
          evidenceDescription: input.evidenceDescription,
        },
      })
    }),

  /**
   * Update a bounty (founder only)
   */
  update: protectedProcedure
    .input(updateBountySchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input

      // Verify ownership via project
      const bounty = await ctx.prisma.bounty.findUnique({
        where: { id },
        include: { project: { select: { founderId: true } } },
      })

      if (!bounty) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Bounty not found' })
      }

      if (bounty.project.founderId !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not own this project',
        })
      }

      return ctx.prisma.bounty.update({
        where: { id },
        data,
      })
    }),

  /**
   * Claim a bounty
   */
  claim: protectedProcedure
    .input(z.object({ bountyId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const bounty = await ctx.prisma.bounty.findUnique({
        where: { id: input.bountyId },
        include: {
          project: { select: { founderId: true } },
          claims: { where: { status: ClaimStatus.ACTIVE } },
        },
      })

      if (!bounty) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Bounty not found' })
      }

      // Check if bounty is open
      if (bounty.status !== BountyStatus.OPEN) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'This bounty is not open for claims',
        })
      }

      // Check existing active claim
      const existingActiveClaim = await ctx.prisma.bountyClaim.findFirst({
        where: {
          bountyId: input.bountyId,
          userId: ctx.user.id,
          status: ClaimStatus.ACTIVE,
        },
      })

      if (existingActiveClaim) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'You have already claimed this bounty',
        })
      }

      // For SINGLE mode, check if already claimed
      if (
        bounty.claimMode === BountyClaimMode.SINGLE &&
        bounty.claims.length > 0
      ) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'This bounty has already been claimed',
        })
      }

      // For MULTIPLE mode with maxClaims, check limit
      if (bounty.maxClaims && bounty.claims.length >= bounty.maxClaims) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'This bounty has reached its maximum number of claims',
        })
      }

      // Calculate expiry date
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + bounty.claimExpiryDays)

      // Create new claim
      const claim = await ctx.prisma.bountyClaim.create({
        data: {
          bountyId: input.bountyId,
          userId: ctx.user.id,
          expiresAt,
        },
      })

      // Update bounty status if SINGLE mode
      if (bounty.claimMode === BountyClaimMode.SINGLE) {
        await ctx.prisma.bounty.update({
          where: { id: input.bountyId },
          data: { status: BountyStatus.CLAIMED },
        })
      }

      return claim
    }),

  /**
   * Release a claim (by claimant or founder)
   */
  releaseClaim: protectedProcedure
    .input(z.object({ claimId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const claim = await ctx.prisma.bountyClaim.findUnique({
        where: { id: input.claimId },
        include: {
          bounty: {
            include: { project: { select: { founderId: true } } },
          },
        },
      })

      if (!claim) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Claim not found' })
      }

      // Only claimant or founder can release
      const isClaimant = claim.userId === ctx.user.id
      const isFounder = claim.bounty.project.founderId === ctx.user.id

      if (!isClaimant && !isFounder) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You cannot release this claim',
        })
      }

      // Update claim status
      await ctx.prisma.bountyClaim.update({
        where: { id: input.claimId },
        data: { status: ClaimStatus.EXPIRED },
      })

      // If SINGLE mode, reopen the bounty
      if (claim.bounty.claimMode === BountyClaimMode.SINGLE) {
        await ctx.prisma.bounty.update({
          where: { id: claim.bountyId },
          data: { status: BountyStatus.OPEN },
        })
      }

      return { success: true }
    }),
})
