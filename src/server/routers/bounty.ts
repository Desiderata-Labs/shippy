import {
  BountyClaimMode,
  BountyEventType,
  BountyStatus,
  ClaimStatus,
  DEFAULT_CLAIM_EXPIRY_DAYS,
  SubmissionEventType,
  SubmissionStatus,
} from '@/lib/db/types'
import { nanoId } from '@/lib/nanoid/schema'
import { protectedProcedure, publicProcedure, router } from '@/server/trpc'
import { Prisma } from '@prisma/client'
import { TRPCError } from '@trpc/server'
import { z } from 'zod/v4'

// Validation schemas
const createBountySchema = z.object({
  projectId: nanoId(),
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  points: z.number().int().min(1),
  labelIds: z.array(nanoId()).optional().default([]), // Labels are optional
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
  id: nanoId(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).optional(),
  points: z.number().int().min(1).optional(),
  labelIds: z.array(nanoId()).optional(), // Labels are optional
  evidenceDescription: z.string().optional().nullable(),
  status: z.nativeEnum(BountyStatus).optional(),
  claimMode: z.nativeEnum(BountyClaimMode).optional(),
  claimExpiryDays: z.number().int().min(1).max(90).optional(),
  maxClaims: z.number().int().min(1).optional().nullable(),
})

export const bountyRouter = router({
  /**
   * Get bounties for a project
   */
  getByProject: publicProcedure
    .input(
      z.object({
        projectId: nanoId(),
        status: z.nativeEnum(BountyStatus).optional(),
        labelIds: z.array(nanoId()).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return ctx.prisma.bounty.findMany({
        where: {
          projectId: input.projectId,
          ...(input.status && { status: input.status }),
          ...(input.labelIds &&
            input.labelIds.length > 0 && {
              labels: { some: { labelId: { in: input.labelIds } } },
            }),
        },
        orderBy: [{ status: 'asc' }, { points: 'desc' }, { createdAt: 'desc' }],
        include: {
          labels: {
            include: { label: true },
          },
          _count: {
            select: {
              claims: {
                where: {
                  status: { in: [ClaimStatus.ACTIVE, ClaimStatus.SUBMITTED] },
                },
              },
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
    .input(z.object({ id: nanoId() }))
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
          labels: {
            include: { label: true },
          },
          claims: {
            where: {
              status: { in: [ClaimStatus.ACTIVE, ClaimStatus.SUBMITTED] },
            },
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
          events: {
            orderBy: { createdAt: 'asc' },
            include: {
              user: { select: { id: true, name: true, image: true } },
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

      // Reserve number + create bounty in a transaction
      // Note: Pool expansion only happens when submissions are approved (points earned),
      // not when bounties are created (points allocated)
      return ctx.prisma.$transaction(async (tx) => {
        const updatedProject = await tx.project.update({
          where: { id: input.projectId },
          data: { nextBountyNumber: { increment: 1 } },
          select: { nextBountyNumber: true },
        })
        const bountyNumber = updatedProject.nextBountyNumber - 1

        const bounty = await tx.bounty.create({
          data: {
            projectId: input.projectId,
            number: bountyNumber,
            title: input.title,
            description: input.description,
            points: input.points,
            claimMode: input.claimMode,
            claimExpiryDays: input.claimExpiryDays,
            maxClaims: input.maxClaims,
            evidenceDescription: input.evidenceDescription,
          },
        })

        // Add labels if provided
        if (input.labelIds.length > 0) {
          await tx.bountyLabel.createMany({
            data: input.labelIds.map((labelId) => ({
              bountyId: bounty.id,
              labelId,
            })),
          })
        }

        return bounty
      })
    }),

  /**
   * Update a bounty (founder only)
   */
  update: protectedProcedure
    .input(updateBountySchema)
    .mutation(async ({ ctx, input }) => {
      const { id, labelIds, ...data } = input

      // Verify ownership via project
      const bounty = await ctx.prisma.bounty.findUnique({
        where: { id },
        include: {
          project: { select: { founderId: true } },
          labels: { select: { labelId: true } },
        },
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

      // Build a record of what changed for the audit trail
      const changes: Record<string, { from: unknown; to: unknown }> = {}

      if (data.title !== undefined && data.title !== bounty.title) {
        changes.title = { from: bounty.title, to: data.title }
      }
      if (
        data.description !== undefined &&
        data.description !== bounty.description
      ) {
        changes.description = { from: bounty.description, to: data.description }
      }
      if (data.points !== undefined && data.points !== bounty.points) {
        changes.points = { from: bounty.points, to: data.points }
      }
      if (labelIds !== undefined) {
        const oldLabelIds = bounty.labels.map((l) => l.labelId).sort()
        const newLabelIds = [...labelIds].sort()
        if (oldLabelIds.join(',') !== newLabelIds.join(',')) {
          changes.labels = { from: oldLabelIds, to: newLabelIds }
        }
      }
      if (data.evidenceDescription !== undefined) {
        if (data.evidenceDescription !== bounty.evidenceDescription) {
          changes.evidenceDescription = {
            from: bounty.evidenceDescription,
            to: data.evidenceDescription,
          }
        }
      }
      if (data.status !== undefined && data.status !== bounty.status) {
        changes.status = { from: bounty.status, to: data.status }
      }
      if (data.claimMode !== undefined && data.claimMode !== bounty.claimMode) {
        changes.claimMode = { from: bounty.claimMode, to: data.claimMode }
      }
      if (
        data.claimExpiryDays !== undefined &&
        data.claimExpiryDays !== bounty.claimExpiryDays
      ) {
        changes.claimExpiryDays = {
          from: bounty.claimExpiryDays,
          to: data.claimExpiryDays,
        }
      }
      if (data.maxClaims !== undefined && data.maxClaims !== bounty.maxClaims) {
        changes.maxClaims = { from: bounty.maxClaims, to: data.maxClaims }
      }

      // Use transaction to update bounty and record the edit event
      return ctx.prisma.$transaction(async (tx) => {
        const updated = await tx.bounty.update({
          where: { id },
          data,
        })

        // Update labels if provided
        if (labelIds !== undefined) {
          // Delete all existing labels
          await tx.bountyLabel.deleteMany({
            where: { bountyId: id },
          })
          // Create new labels
          if (labelIds.length > 0) {
            await tx.bountyLabel.createMany({
              data: labelIds.map((labelId) => ({
                bountyId: id,
                labelId,
              })),
            })
          }
        }

        // Only create an event if something actually changed
        if (Object.keys(changes).length > 0) {
          // If status changed, create a STATUS_CHANGE event; otherwise EDIT
          if (changes.status) {
            await tx.bountyEvent.create({
              data: {
                bountyId: id,
                userId: ctx.user.id,
                type: BountyEventType.STATUS_CHANGE,
                fromStatus: changes.status.from as string,
                toStatus: changes.status.to as string,
              },
            })
            // If there are other changes besides status, also record an edit
            const nonStatusChanges = { ...changes }
            delete nonStatusChanges.status
            if (Object.keys(nonStatusChanges).length > 0) {
              await tx.bountyEvent.create({
                data: {
                  bountyId: id,
                  userId: ctx.user.id,
                  type: BountyEventType.EDIT,
                  changes: nonStatusChanges as Prisma.InputJsonValue,
                },
              })
            }
          } else {
            await tx.bountyEvent.create({
              data: {
                bountyId: id,
                userId: ctx.user.id,
                type: BountyEventType.EDIT,
                changes: changes as Prisma.InputJsonValue,
              },
            })
          }
        }

        return updated
      })
    }),

  /**
   * Claim a bounty
   */
  claim: protectedProcedure
    .input(z.object({ bountyId: nanoId() }))
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
    .input(
      z.object({
        claimId: nanoId(),
        reason: z.string().max(1000).optional(),
      }),
    )
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

      // Find and withdraw any pending submissions from this user for this bounty
      const submissionsToWithdraw = await ctx.prisma.submission.findMany({
        where: {
          bountyId: claim.bountyId,
          userId: claim.userId,
          status: {
            in: [
              SubmissionStatus.DRAFT,
              SubmissionStatus.PENDING,
              SubmissionStatus.NEEDS_INFO,
            ],
          },
        },
        select: { id: true, status: true },
      })

      // Update submissions and create withdrawal events
      for (const submission of submissionsToWithdraw) {
        await ctx.prisma.submission.update({
          where: { id: submission.id },
          data: { status: SubmissionStatus.WITHDRAWN },
        })

        await ctx.prisma.submissionEvent.create({
          data: {
            submissionId: submission.id,
            userId: claim.userId,
            type: SubmissionEventType.STATUS_CHANGE,
            fromStatus: submission.status,
            toStatus: SubmissionStatus.WITHDRAWN,
            note: input.reason || null,
          },
        })
      }

      // If SINGLE mode and bounty is still CLAIMED (not COMPLETED/CLOSED), reopen it
      if (
        claim.bounty.claimMode === BountyClaimMode.SINGLE &&
        claim.bounty.status === BountyStatus.CLAIMED
      ) {
        // Check if there are any other active/submitted claims
        const remainingClaims = await ctx.prisma.bountyClaim.count({
          where: {
            bountyId: claim.bountyId,
            status: { in: [ClaimStatus.ACTIVE, ClaimStatus.SUBMITTED] },
          },
        })

        if (remainingClaims === 0) {
          await ctx.prisma.bounty.update({
            where: { id: claim.bountyId },
            data: { status: BountyStatus.OPEN },
          })
        }
      }

      return { success: true }
    }),

  /**
   * Add a comment to a bounty
   */
  addComment: protectedProcedure
    .input(
      z.object({
        bountyId: nanoId(),
        content: z.string().min(1).max(5000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify bounty exists
      const bounty = await ctx.prisma.bounty.findUnique({
        where: { id: input.bountyId },
        include: { project: { select: { founderId: true, isPublic: true } } },
      })

      if (!bounty) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Bounty not found' })
      }

      // Only allow comments on public projects or if user is founder
      if (
        !bounty.project.isPublic &&
        bounty.project.founderId !== ctx.user.id
      ) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' })
      }

      return ctx.prisma.bountyEvent.create({
        data: {
          bountyId: input.bountyId,
          userId: ctx.user.id,
          type: BountyEventType.COMMENT,
          content: input.content,
        },
        include: {
          user: { select: { id: true, name: true, image: true } },
        },
      })
    }),

  /**
   * Get events (comments, edits, status changes) for a bounty
   */
  getEvents: publicProcedure
    .input(z.object({ bountyId: nanoId() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.bountyEvent.findMany({
        where: { bountyId: input.bountyId },
        orderBy: { createdAt: 'asc' },
        include: {
          user: { select: { id: true, name: true, image: true } },
        },
      })
    }),

  /**
   * Delete a comment event (author or founder only)
   */
  deleteComment: protectedProcedure
    .input(z.object({ eventId: nanoId() }))
    .mutation(async ({ ctx, input }) => {
      const event = await ctx.prisma.bountyEvent.findUnique({
        where: { id: input.eventId },
        include: {
          bounty: { include: { project: { select: { founderId: true } } } },
        },
      })

      if (!event) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' })
      }

      // Can only delete COMMENT events
      if (event.type !== BountyEventType.COMMENT) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Only comments can be deleted',
        })
      }

      const isAuthor = event.userId === ctx.user.id
      const isFounder = event.bounty.project.founderId === ctx.user.id

      if (!isAuthor && !isFounder) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You cannot delete this comment',
        })
      }

      await ctx.prisma.bountyEvent.delete({
        where: { id: input.eventId },
      })

      return { success: true }
    }),
})
