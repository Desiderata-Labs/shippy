import {
  BountyStatus,
  ClaimStatus,
  SubmissionEventType,
  SubmissionStatus,
} from '@/lib/db/types'
import { protectedProcedure, router } from '@/server/trpc'
import { Prisma } from '@prisma/client'
import { TRPCError } from '@trpc/server'
import { z } from 'zod/v4'

// Validation schemas
const createSubmissionSchema = z.object({
  bountyId: z.string().uuid(),
  description: z.string().min(1),
  isDraft: z.boolean().default(false),
})

const updateSubmissionSchema = z.object({
  id: z.string().uuid(),
  description: z.string().min(1).optional(),
  status: z.enum([SubmissionStatus.DRAFT, SubmissionStatus.PENDING]).optional(),
})

const reviewSubmissionSchema = z
  .object({
    id: z.string().uuid(),
    action: z.enum(['approve', 'reject', 'requestInfo']),
    note: z.string().optional(),
    pointsAwarded: z.number().int().min(0).optional(), // Can override default points
  })
  .refine(
    (data) => {
      // Require note for reject and requestInfo actions
      if (data.action === 'reject' || data.action === 'requestInfo') {
        return data.note && data.note.trim().length > 0
      }
      return true
    },
    {
      message: 'A comment is required when rejecting or requesting more info',
      path: ['note'],
    },
  )

const addMessageSchema = z.object({
  submissionId: z.string().uuid(),
  content: z.string().min(1),
})

export const submissionRouter = router({
  /**
   * Get submissions for the current user
   */
  mySubmissions: protectedProcedure
    .input(
      z.object({
        status: z.enum(SubmissionStatus).optional(),
        projectId: z.uuid().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return ctx.prisma.submission.findMany({
        where: {
          userId: ctx.user.id,
          ...(input.status && { status: input.status }),
          ...(input.projectId && { bounty: { projectId: input.projectId } }),
        },
        orderBy: { createdAt: 'desc' },
        include: {
          bounty: {
            include: {
              project: { select: { id: true, name: true, slug: true } },
            },
          },
          _count: { select: { events: true } },
        },
      })
    }),

  /**
   * Get pending submissions for a project (founder only)
   */
  pendingForProject: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Verify ownership
      const project = await ctx.prisma.project.findUnique({
        where: { id: input.projectId },
        select: { founderId: true },
      })

      if (!project || project.founderId !== ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' })
      }

      return ctx.prisma.submission.findMany({
        where: {
          bounty: { projectId: input.projectId },
          status: {
            in: [SubmissionStatus.PENDING, SubmissionStatus.NEEDS_INFO],
          },
        },
        orderBy: { createdAt: 'asc' },
        include: {
          user: { select: { id: true, name: true, image: true, email: true } },
          bounty: true,
          events: {
            orderBy: { createdAt: 'asc' },
            include: {
              user: { select: { id: true, name: true, image: true } },
            },
          },
          attachments: true,
        },
      })
    }),

  /**
   * Get a single submission with full details
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const submission = await ctx.prisma.submission.findUnique({
        where: { id: input.id },
        include: {
          user: { select: { id: true, name: true, image: true, email: true } },
          bounty: {
            include: {
              project: {
                include: {
                  founder: { select: { id: true, name: true, image: true } },
                  rewardPool: true,
                },
              },
            },
          },
          events: {
            orderBy: { createdAt: 'asc' },
            include: {
              user: { select: { id: true, name: true, image: true } },
            },
          },
          attachments: true,
        },
      })

      if (!submission) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Submission not found',
        })
      }

      // Only submitter or founder can view
      const isSubmitter = submission.userId === ctx.user.id
      const isFounder = submission.bounty.project.founderId === ctx.user.id

      if (!isSubmitter && !isFounder) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' })
      }

      return submission
    }),

  /**
   * Create a submission
   */
  create: protectedProcedure
    .input(createSubmissionSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify bounty exists and is open/claimed
      const bounty = await ctx.prisma.bounty.findUnique({
        where: { id: input.bountyId },
        include: {
          project: { select: { founderId: true } },
        },
      })

      if (!bounty) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Bounty not found' })
      }

      // Check if user has an active claim
      const claim = await ctx.prisma.bountyClaim.findFirst({
        where: {
          bountyId: input.bountyId,
          userId: ctx.user.id,
          status: ClaimStatus.ACTIVE,
        },
      })

      if (!claim) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'You must claim this bounty before submitting',
        })
      }

      // Check for existing submission
      const existingSubmission = await ctx.prisma.submission.findFirst({
        where: {
          bountyId: input.bountyId,
          userId: ctx.user.id,
          status: { notIn: [SubmissionStatus.REJECTED] },
        },
      })

      if (existingSubmission) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'You already have a submission for this bounty',
        })
      }

      // Create submission
      const submission = await ctx.prisma.submission.create({
        data: {
          bountyId: input.bountyId,
          userId: ctx.user.id,
          description: input.description,
          status: input.isDraft
            ? SubmissionStatus.DRAFT
            : SubmissionStatus.PENDING,
        },
      })

      // Update claim status
      await ctx.prisma.bountyClaim.update({
        where: { id: claim.id },
        data: { status: ClaimStatus.SUBMITTED },
      })

      return submission
    }),

  /**
   * Update a submission (submitter only, before approval)
   */
  update: protectedProcedure
    .input(updateSubmissionSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input

      const submission = await ctx.prisma.submission.findUnique({
        where: { id },
      })

      if (!submission) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Submission not found',
        })
      }

      if (submission.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You cannot edit this submission',
        })
      }

      // Can only edit if not yet approved/rejected/withdrawn
      if (
        submission.status === SubmissionStatus.APPROVED ||
        submission.status === SubmissionStatus.REJECTED ||
        submission.status === SubmissionStatus.WITHDRAWN
      ) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot edit a finalized submission',
        })
      }

      // Build a record of what changed for the audit trail
      const changes: Record<string, { from: unknown; to: unknown }> = {}

      if (
        data.description !== undefined &&
        data.description !== submission.description
      ) {
        changes.description = {
          from: submission.description,
          to: data.description,
        }
      }
      if (data.status !== undefined && data.status !== submission.status) {
        changes.status = { from: submission.status, to: data.status }
      }

      // Use transaction to update submission and record the edit event
      return ctx.prisma.$transaction(async (tx) => {
        const updated = await tx.submission.update({
          where: { id },
          data,
        })

        // Only create an event if something actually changed
        if (Object.keys(changes).length > 0) {
          // If status changed, create a STATUS_CHANGE event; otherwise EDIT
          if (changes.status) {
            await tx.submissionEvent.create({
              data: {
                submissionId: id,
                userId: ctx.user.id,
                type: SubmissionEventType.STATUS_CHANGE,
                fromStatus: changes.status.from as string,
                toStatus: changes.status.to as string,
              },
            })
            // If there are other changes besides status, also record an edit
            const nonStatusChanges = { ...changes }
            delete nonStatusChanges.status
            if (Object.keys(nonStatusChanges).length > 0) {
              await tx.submissionEvent.create({
                data: {
                  submissionId: id,
                  userId: ctx.user.id,
                  type: SubmissionEventType.EDIT,
                  changes: nonStatusChanges as Prisma.InputJsonValue,
                },
              })
            }
          } else {
            await tx.submissionEvent.create({
              data: {
                submissionId: id,
                userId: ctx.user.id,
                type: SubmissionEventType.EDIT,
                changes: changes as Prisma.InputJsonValue,
              },
            })
          }
        }

        return updated
      })
    }),

  /**
   * Review a submission (founder only)
   */
  review: protectedProcedure
    .input(reviewSubmissionSchema)
    .mutation(async ({ ctx, input }) => {
      const submission = await ctx.prisma.submission.findUnique({
        where: { id: input.id },
        include: {
          bounty: {
            include: { project: { select: { founderId: true } } },
          },
        },
      })

      if (!submission) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Submission not found',
        })
      }

      if (submission.bounty.project.founderId !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not own this project',
        })
      }

      const now = new Date()

      const previousStatus = submission.status

      switch (input.action) {
        case 'approve': {
          const pointsAwarded = input.pointsAwarded ?? submission.bounty.points

          // Update submission (clear any previous rejection data)
          await ctx.prisma.submission.update({
            where: { id: input.id },
            data: {
              status: SubmissionStatus.APPROVED,
              pointsAwarded,
              approvedAt: now,
              rejectedAt: null,
              rejectionNote: null,
            },
          })

          // Update claim status
          await ctx.prisma.bountyClaim.updateMany({
            where: {
              bountyId: submission.bountyId,
              userId: submission.userId,
            },
            data: { status: ClaimStatus.COMPLETED },
          })

          // Add approval event to timeline
          await ctx.prisma.submissionEvent.create({
            data: {
              submissionId: input.id,
              userId: ctx.user.id,
              type: SubmissionEventType.STATUS_CHANGE,
              fromStatus: previousStatus,
              toStatus: SubmissionStatus.APPROVED,
              note: input.note || null,
            },
          })

          // Check if bounty should be marked as completed
          // (For SINGLE mode or if all claims are completed)
          const activeClaims = await ctx.prisma.bountyClaim.count({
            where: {
              bountyId: submission.bountyId,
              status: { in: [ClaimStatus.ACTIVE, ClaimStatus.SUBMITTED] },
            },
          })

          if (activeClaims === 0) {
            await ctx.prisma.bounty.update({
              where: { id: submission.bountyId },
              data: { status: BountyStatus.COMPLETED },
            })
          }

          break
        }

        case 'reject': {
          await ctx.prisma.submission.update({
            where: { id: input.id },
            data: {
              status: SubmissionStatus.REJECTED,
              rejectedAt: now,
              rejectionNote: input.note,
            },
          })

          // Add rejection event to timeline
          await ctx.prisma.submissionEvent.create({
            data: {
              submissionId: input.id,
              userId: ctx.user.id,
              type: SubmissionEventType.STATUS_CHANGE,
              fromStatus: previousStatus,
              toStatus: SubmissionStatus.REJECTED,
              note: input.note,
            },
          })

          break
        }

        case 'requestInfo': {
          await ctx.prisma.submission.update({
            where: { id: input.id },
            data: { status: SubmissionStatus.NEEDS_INFO },
          })

          // Add info request event to timeline
          await ctx.prisma.submissionEvent.create({
            data: {
              submissionId: input.id,
              userId: ctx.user.id,
              type: SubmissionEventType.STATUS_CHANGE,
              fromStatus: previousStatus,
              toStatus: SubmissionStatus.NEEDS_INFO,
              note: input.note,
            },
          })

          break
        }
      }

      return { success: true }
    }),

  /**
   * Add a comment to a submission thread
   */
  addComment: protectedProcedure
    .input(addMessageSchema)
    .mutation(async ({ ctx, input }) => {
      const submission = await ctx.prisma.submission.findUnique({
        where: { id: input.submissionId },
        include: {
          bounty: { include: { project: { select: { founderId: true } } } },
        },
      })

      if (!submission) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Submission not found',
        })
      }

      // Only submitter or founder can add comments
      const isSubmitter = submission.userId === ctx.user.id
      const isFounder = submission.bounty.project.founderId === ctx.user.id

      if (!isSubmitter && !isFounder) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' })
      }

      return ctx.prisma.submissionEvent.create({
        data: {
          submissionId: input.submissionId,
          userId: ctx.user.id,
          type: SubmissionEventType.COMMENT,
          content: input.content,
        },
        include: {
          user: { select: { id: true, name: true, image: true } },
        },
      })
    }),
})
