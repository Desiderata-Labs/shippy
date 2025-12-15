import {
  BountyStatus,
  ClaimStatus,
  SubmissionEventType,
  SubmissionStatus,
} from '@/lib/db/types'
import { nanoId } from '@/lib/nanoid/zod'
import { protectedProcedure, router, userError } from '@/server/trpc'
import { Prisma } from '@prisma/client'
import { z } from 'zod/v4'

// Validation schemas
const createSubmissionSchema = z.object({
  bountyId: nanoId(),
  description: z.string().min(1),
  isDraft: z.boolean().default(false),
})

const updateSubmissionSchema = z.object({
  id: nanoId(),
  description: z.string().min(1).optional(),
  status: z.enum([SubmissionStatus.DRAFT, SubmissionStatus.PENDING]).optional(),
})

const reviewSubmissionSchema = z
  .object({
    id: nanoId(),
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
  submissionId: nanoId(),
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
        projectId: nanoId().optional(),
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
    .input(z.object({ projectId: nanoId() }))
    .query(async ({ ctx, input }) => {
      // Verify ownership
      const project = await ctx.prisma.project.findUnique({
        where: { id: input.projectId },
        select: { founderId: true },
      })

      if (!project || project.founderId !== ctx.user.id) {
        throw userError('FORBIDDEN', 'Access denied')
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
    .input(z.object({ id: nanoId() }))
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
        throw userError('NOT_FOUND', 'Submission not found')
      }

      // Only submitter or founder can view
      const isSubmitter = submission.userId === ctx.user.id
      const isFounder = submission.bounty.project.founderId === ctx.user.id

      if (!isSubmitter && !isFounder) {
        throw userError('FORBIDDEN', 'Access denied')
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
        throw userError('NOT_FOUND', 'Bounty not found')
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
        throw userError(
          'BAD_REQUEST',
          'You must claim this bounty before submitting',
        )
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
        throw userError(
          'CONFLICT',
          'You already have a submission for this bounty',
        )
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
        throw userError('NOT_FOUND', 'Submission not found')
      }

      if (submission.userId !== ctx.user.id) {
        throw userError('FORBIDDEN', 'You cannot edit this submission')
      }

      // Can only edit if not yet approved/rejected/withdrawn
      if (
        submission.status === SubmissionStatus.APPROVED ||
        submission.status === SubmissionStatus.REJECTED ||
        submission.status === SubmissionStatus.WITHDRAWN
      ) {
        throw userError('BAD_REQUEST', 'Cannot edit a finalized submission')
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
            include: {
              project: {
                include: {
                  rewardPool: true,
                },
              },
            },
          },
        },
      })

      if (!submission) {
        throw userError('NOT_FOUND', 'Submission not found')
      }

      if (submission.bounty.project.founderId !== ctx.user.id) {
        throw userError('FORBIDDEN', 'You do not own this project')
      }

      const now = new Date()

      const previousStatus = submission.status

      switch (input.action) {
        case 'approve': {
          const pointsAwarded = input.pointsAwarded ?? submission.bounty.points

          // Can't approve without points
          if (pointsAwarded === null || pointsAwarded === undefined) {
            throw userError(
              'BAD_REQUEST',
              'Cannot approve submission: bounty has no points assigned. Please assign points first.',
            )
          }

          const project = submission.bounty.project
          const rewardPool = project.rewardPool

          // Check if we need to auto-expand pool capacity
          if (rewardPool) {
            // Get current total earned points
            const earnedResult = await ctx.prisma.submission.aggregate({
              where: {
                bounty: { projectId: project.id },
                status: SubmissionStatus.APPROVED,
                pointsAwarded: { not: null },
              },
              _sum: { pointsAwarded: true },
            })
            const currentEarned = earnedResult._sum.pointsAwarded ?? 0
            const newTotalEarned = currentEarned + pointsAwarded

            // Auto-expand if earned would exceed capacity
            if (newTotalEarned > rewardPool.poolCapacity) {
              const dilutionPercent =
                ((newTotalEarned - rewardPool.poolCapacity) / newTotalEarned) *
                100

              // Expand pool capacity
              await ctx.prisma.rewardPool.update({
                where: { id: rewardPool.id },
                data: { poolCapacity: newTotalEarned },
              })

              // Log the expansion event
              const bountyDisplayId = `${project.projectKey}-${submission.bounty.number}`
              await ctx.prisma.poolExpansionEvent.create({
                data: {
                  rewardPoolId: rewardPool.id,
                  previousCapacity: rewardPool.poolCapacity,
                  newCapacity: newTotalEarned,
                  reason: `Auto-expanded when awarding ${pointsAwarded} pts for ${bountyDisplayId}`,
                  dilutionPercent,
                },
              })
            }
          }

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
        throw userError('NOT_FOUND', 'Submission not found')
      }

      // Only submitter or founder can add comments
      const isSubmitter = submission.userId === ctx.user.id
      const isFounder = submission.bounty.project.founderId === ctx.user.id

      if (!isSubmitter && !isFounder) {
        throw userError('FORBIDDEN', 'Access denied')
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
