import {
  BountyClaimMode,
  BountyEventType,
  BountyStatus,
  ClaimStatus,
  DEFAULT_CLAIM_EXPIRY_DAYS,
  SubmissionEventType,
  SubmissionStatus,
} from '@/lib/db/types'
import { nanoId } from '@/lib/nanoid/zod'
import {
  protectedProcedure,
  publicProcedure,
  router,
  userError,
} from '@/server/trpc'
import { Prisma } from '@prisma/client'
import { z } from 'zod/v4'

// Validation schemas
const createBountySchema = z.object({
  projectId: nanoId(),
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  points: z.number().int().min(1).nullable(), // null = backlog (estimate later)
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
  points: z.number().int().min(1).nullable().optional(), // null = backlog (estimate later)
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
              user: {
                select: { id: true, name: true, image: true, username: true },
              },
            },
          },
          submissions: {
            orderBy: { createdAt: 'desc' },
            include: {
              user: {
                select: { id: true, name: true, image: true, username: true },
              },
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
        throw userError('NOT_FOUND', 'Bounty not found')
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
        throw userError('NOT_FOUND', 'Project not found')
      }

      if (project.founderId !== ctx.user.id) {
        throw userError('FORBIDDEN', 'You do not own this project')
      }

      if (!project.rewardPool) {
        throw userError('BAD_REQUEST', 'Project does not have a reward pool')
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

        // If no points provided, this is a backlog bounty
        const status =
          input.points === null ? BountyStatus.BACKLOG : BountyStatus.OPEN

        const bounty = await tx.bounty.create({
          data: {
            projectId: input.projectId,
            number: bountyNumber,
            title: input.title,
            description: input.description,
            points: input.points,
            status,
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
        throw userError('NOT_FOUND', 'Bounty not found')
      }

      if (bounty.project.founderId !== ctx.user.id) {
        throw userError('FORBIDDEN', 'You do not own this project')
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

      // Prevent changing points on completed/closed bounties
      if (data.points !== undefined && data.points !== bounty.points) {
        if (
          bounty.status === BountyStatus.COMPLETED ||
          bounty.status === BountyStatus.CLOSED
        ) {
          throw userError(
            'BAD_REQUEST',
            'Cannot change points on a completed or closed bounty',
          )
        }

        // Prevent removing points (backlog) on claimed bounties
        if (bounty.status === BountyStatus.CLAIMED && data.points === null) {
          throw userError(
            'BAD_REQUEST',
            'Cannot remove points from a bounty that is being worked on',
          )
        }
      }

      // Handle automatic status transitions based on points changes
      // - BACKLOG -> OPEN: when points are assigned
      // - OPEN -> BACKLOG: when points are removed (only if no claims/submissions)
      const updateData = { ...data }
      if (data.points !== undefined) {
        const wasBacklog = bounty.status === BountyStatus.BACKLOG
        const wasOpen = bounty.status === BountyStatus.OPEN
        const nowHasPoints = data.points !== null
        const nowNoPoints = data.points === null

        if (wasBacklog && nowHasPoints && !data.status) {
          // Auto-transition from BACKLOG to OPEN when points are assigned
          updateData.status = BountyStatus.OPEN
          changes.status = { from: BountyStatus.BACKLOG, to: BountyStatus.OPEN }
        } else if (wasOpen && nowNoPoints && !data.status) {
          // Auto-transition from OPEN to BACKLOG when points are removed
          updateData.status = BountyStatus.BACKLOG
          changes.status = { from: BountyStatus.OPEN, to: BountyStatus.BACKLOG }
        }
      }

      // Use transaction to update bounty and record the edit event
      return ctx.prisma.$transaction(async (tx) => {
        const updated = await tx.bounty.update({
          where: { id },
          data: updateData,
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
        throw userError('NOT_FOUND', 'Bounty not found')
      }

      // Check if bounty can be claimed
      // - BACKLOG bounties cannot be claimed (no points assigned yet)
      // - COMPLETED/CLOSED bounties cannot be claimed
      // - OPEN bounties can always be claimed
      // - CLAIMED bounties can be claimed if in MULTIPLE (competitive) mode
      if (bounty.status === BountyStatus.BACKLOG) {
        throw userError(
          'BAD_REQUEST',
          'This bounty is in the backlog and cannot be claimed yet',
        )
      }

      if (bounty.status === BountyStatus.COMPLETED) {
        throw userError('BAD_REQUEST', 'This bounty has already been completed')
      }

      if (bounty.status === BountyStatus.CLOSED) {
        throw userError('BAD_REQUEST', 'This bounty is closed')
      }

      // For CLAIMED bounties, only allow if in MULTIPLE mode (competitive)
      if (
        bounty.status === BountyStatus.CLAIMED &&
        bounty.claimMode !== BountyClaimMode.MULTIPLE
      ) {
        throw userError('BAD_REQUEST', 'This bounty has already been claimed')
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
        throw userError('CONFLICT', 'You have already claimed this bounty')
      }

      // For SINGLE mode, check if already claimed
      if (
        bounty.claimMode === BountyClaimMode.SINGLE &&
        bounty.claims.length > 0
      ) {
        throw userError('CONFLICT', 'This bounty has already been claimed')
      }

      // For MULTIPLE mode with maxClaims, check limit
      if (bounty.maxClaims && bounty.claims.length >= bounty.maxClaims) {
        throw userError(
          'CONFLICT',
          'This bounty has reached its maximum number of claims',
        )
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

      // Update bounty status to CLAIMED if this is the first claim
      // For both SINGLE and MULTIPLE mode, status should reflect work is in progress
      if (bounty.status === BountyStatus.OPEN) {
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
        throw userError('NOT_FOUND', 'Claim not found')
      }

      // Only claimant or founder can release
      const isClaimant = claim.userId === ctx.user.id
      const isFounder = claim.bounty.project.founderId === ctx.user.id

      if (!isClaimant && !isFounder) {
        throw userError('FORBIDDEN', 'You cannot release this claim')
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
        throw userError('NOT_FOUND', 'Bounty not found')
      }

      // Only allow comments on public projects or if user is founder
      if (
        !bounty.project.isPublic &&
        bounty.project.founderId !== ctx.user.id
      ) {
        throw userError('FORBIDDEN', 'Access denied')
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
        throw userError('NOT_FOUND', 'Event not found')
      }

      // Can only delete COMMENT events
      if (event.type !== BountyEventType.COMMENT) {
        throw userError('BAD_REQUEST', 'Only comments can be deleted')
      }

      const isAuthor = event.userId === ctx.user.id
      const isFounder = event.bounty.project.founderId === ctx.user.id

      if (!isAuthor && !isFounder) {
        throw userError('FORBIDDEN', 'You cannot delete this comment')
      }

      await ctx.prisma.bountyEvent.delete({
        where: { id: input.eventId },
      })

      return { success: true }
    }),

  /**
   * Close a bounty (founder only)
   * Can close BACKLOG, OPEN, or CLAIMED bounties
   * Cannot close COMPLETED or already CLOSED bounties
   */
  close: protectedProcedure
    .input(
      z.object({
        bountyId: nanoId(),
        reason: z.string().max(1000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const bounty = await ctx.prisma.bounty.findUnique({
        where: { id: input.bountyId },
        include: {
          project: { select: { founderId: true } },
          claims: {
            where: {
              status: { in: [ClaimStatus.ACTIVE, ClaimStatus.SUBMITTED] },
            },
            select: { id: true, userId: true, status: true },
          },
          submissions: {
            where: {
              status: {
                in: [
                  SubmissionStatus.DRAFT,
                  SubmissionStatus.PENDING,
                  SubmissionStatus.NEEDS_INFO,
                ],
              },
            },
            select: { id: true, status: true, userId: true },
          },
        },
      })

      if (!bounty) {
        throw userError('NOT_FOUND', 'Bounty not found')
      }

      if (bounty.project.founderId !== ctx.user.id) {
        throw userError('FORBIDDEN', 'You do not own this project')
      }

      // Cannot close completed bounties (points already awarded)
      if (bounty.status === BountyStatus.COMPLETED) {
        throw userError(
          'BAD_REQUEST',
          'Cannot close a completed bounty - points have been awarded',
        )
      }

      // Already closed
      if (bounty.status === BountyStatus.CLOSED) {
        throw userError('BAD_REQUEST', 'Bounty is already closed')
      }

      const previousStatus = bounty.status

      // Use transaction to update everything
      return ctx.prisma.$transaction(async (tx) => {
        // Expire all active claims
        if (bounty.claims.length > 0) {
          await tx.bountyClaim.updateMany({
            where: {
              bountyId: input.bountyId,
              status: { in: [ClaimStatus.ACTIVE, ClaimStatus.SUBMITTED] },
            },
            data: { status: ClaimStatus.EXPIRED },
          })
        }

        // Withdraw all pending submissions
        for (const submission of bounty.submissions) {
          await tx.submission.update({
            where: { id: submission.id },
            data: { status: SubmissionStatus.WITHDRAWN },
          })

          await tx.submissionEvent.create({
            data: {
              submissionId: submission.id,
              userId: ctx.user.id,
              type: SubmissionEventType.STATUS_CHANGE,
              fromStatus: submission.status,
              toStatus: SubmissionStatus.WITHDRAWN,
              note: input.reason
                ? `Bounty closed: ${input.reason}`
                : 'Bounty closed by founder',
            },
          })
        }

        // Update bounty status
        const updated = await tx.bounty.update({
          where: { id: input.bountyId },
          data: { status: BountyStatus.CLOSED },
        })

        // Create status change event
        await tx.bountyEvent.create({
          data: {
            bountyId: input.bountyId,
            userId: ctx.user.id,
            type: BountyEventType.STATUS_CHANGE,
            fromStatus: previousStatus,
            toStatus: BountyStatus.CLOSED,
            content: input.reason || null,
          },
        })

        return updated
      })
    }),

  /**
   * Reopen a closed bounty (founder only)
   * Reopens to OPEN status (or BACKLOG if no points)
   */
  reopen: protectedProcedure
    .input(
      z.object({
        bountyId: nanoId(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const bounty = await ctx.prisma.bounty.findUnique({
        where: { id: input.bountyId },
        include: {
          project: { select: { founderId: true } },
        },
      })

      if (!bounty) {
        throw userError('NOT_FOUND', 'Bounty not found')
      }

      if (bounty.project.founderId !== ctx.user.id) {
        throw userError('FORBIDDEN', 'You do not own this project')
      }

      // Can only reopen closed bounties
      if (bounty.status !== BountyStatus.CLOSED) {
        throw userError('BAD_REQUEST', 'Only closed bounties can be reopened')
      }

      // Determine new status based on points
      const newStatus =
        bounty.points === null ? BountyStatus.BACKLOG : BountyStatus.OPEN

      return ctx.prisma.$transaction(async (tx) => {
        const updated = await tx.bounty.update({
          where: { id: input.bountyId },
          data: { status: newStatus },
        })

        // Create status change event
        await tx.bountyEvent.create({
          data: {
            bountyId: input.bountyId,
            userId: ctx.user.id,
            type: BountyEventType.STATUS_CHANGE,
            fromStatus: BountyStatus.CLOSED,
            toStatus: newStatus,
          },
        })

        return updated
      })
    }),
})
