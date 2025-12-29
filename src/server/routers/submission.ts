import {
  NotificationReferenceType,
  NotificationType,
  SubmissionEventType,
  SubmissionStatus,
} from '@/lib/db/types'
import { nanoId } from '@/lib/nanoid/zod'
import {
  createNotifications,
  getSubmissionCommentRecipients,
  resolveMentionedUserIds,
} from './notification'
import {
  approveSubmission,
  createSubmission,
  rejectSubmission,
  updateSubmission,
} from '@/server/services/submission'
import { protectedProcedure, router, userError } from '@/server/trpc'
import { z } from 'zod/v4'

// Validation schemas
const createSubmissionSchema = z.object({
  id: nanoId().optional(), // Optional pre-generated ID for attachment association
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
          user: {
            select: {
              id: true,
              name: true,
              image: true,
              email: true,
              username: true,
            },
          },
          bounty: true,
          events: {
            orderBy: { createdAt: 'asc' },
            include: {
              user: {
                select: { id: true, name: true, image: true, username: true },
              },
            },
          },
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
          user: {
            select: {
              id: true,
              name: true,
              image: true,
              email: true,
              username: true,
            },
          },
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
              user: {
                select: { id: true, name: true, image: true, username: true },
              },
            },
          },
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
      // Use the shared submission creation service
      const result = await createSubmission({
        prisma: ctx.prisma,
        id: input.id,
        bountyId: input.bountyId,
        userId: ctx.user.id,
        description: input.description,
        isDraft: input.isDraft,
      })

      if (!result.success) {
        const errorMap: Record<
          string,
          'NOT_FOUND' | 'BAD_REQUEST' | 'CONFLICT'
        > = {
          NOT_FOUND: 'NOT_FOUND',
          NO_CLAIM: 'BAD_REQUEST',
          ALREADY_SUBMITTED: 'CONFLICT',
        }
        throw userError(errorMap[result.code] ?? 'BAD_REQUEST', result.message)
      }

      return result.submission
    }),

  /**
   * Update a submission (submitter only, before approval)
   */
  update: protectedProcedure
    .input(updateSubmissionSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input
      const result = await updateSubmission({
        prisma: ctx.prisma,
        submissionId: id,
        userId: ctx.user.id,
        description: data.description,
        status: data.status,
      })

      if (!result.success) {
        const errorMap: Record<
          string,
          'NOT_FOUND' | 'BAD_REQUEST' | 'FORBIDDEN'
        > = {
          NOT_FOUND: 'NOT_FOUND',
          FORBIDDEN: 'FORBIDDEN',
          FINALIZED: 'BAD_REQUEST',
          NO_CHANGES: 'BAD_REQUEST',
        }
        throw userError(errorMap[result.code] ?? 'BAD_REQUEST', result.message)
      }

      return result.submission
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

          // Use shared approval service
          await approveSubmission({
            prisma: ctx.prisma,
            submissionId: input.id,
            pointsAwarded,
            actorId: ctx.user.id,
            note: input.note,
          })

          break
        }

        case 'reject': {
          // Use shared rejection service (expires claim and updates bounty status)
          await rejectSubmission({
            prisma: ctx.prisma,
            submissionId: input.id,
            actorId: ctx.user.id,
            note: input.note,
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

          // Notify contributor about info request
          createNotifications({
            prisma: ctx.prisma,
            type: NotificationType.SUBMISSION_NEEDS_INFO,
            referenceType: NotificationReferenceType.SUBMISSION,
            referenceId: submission.id,
            actorId: ctx.user.id,
            recipientIds: [submission.userId],
          }).catch((err) => {
            console.error('Failed to create needs info notification:', err)
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

      // Get recipients before creating the comment (so we don't include this comment's author twice)
      // Pass content to include @mentioned users
      const { threadRecipients, mentionedRecipients } =
        await getSubmissionCommentRecipients(
          ctx.prisma,
          input.submissionId,
          input.content,
        )

      const comment = await ctx.prisma.submissionEvent.create({
        data: {
          submissionId: input.submissionId,
          userId: ctx.user.id,
          type: SubmissionEventType.COMMENT,
          content: input.content,
        },
        include: {
          user: {
            select: { id: true, name: true, image: true, username: true },
          },
        },
      })

      // Create notifications for thread participants (runs in background, don't await)
      createNotifications({
        prisma: ctx.prisma,
        type: NotificationType.SUBMISSION_COMMENT,
        referenceType: NotificationReferenceType.SUBMISSION,
        referenceId: input.submissionId,
        actorId: ctx.user.id,
        recipientIds: threadRecipients,
      }).catch((err) => {
        console.error('Failed to create submission comment notifications:', err)
      })

      // Create separate notifications for mentioned-only users
      if (mentionedRecipients.length > 0) {
        createNotifications({
          prisma: ctx.prisma,
          type: NotificationType.SUBMISSION_MENTION,
          referenceType: NotificationReferenceType.SUBMISSION,
          referenceId: input.submissionId,
          actorId: ctx.user.id,
          recipientIds: mentionedRecipients,
        }).catch((err) => {
          console.error(
            'Failed to create submission mention notifications:',
            err,
          )
        })
      }

      return comment
    }),

  /**
   * Update a comment (author only)
   */
  updateComment: protectedProcedure
    .input(
      z.object({
        eventId: nanoId(),
        content: z.string().min(1).max(5000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const event = await ctx.prisma.submissionEvent.findUnique({
        where: { id: input.eventId },
        include: {
          submission: {
            include: {
              bounty: { include: { project: { select: { founderId: true } } } },
            },
          },
        },
      })

      if (!event) {
        throw userError('NOT_FOUND', 'Event not found')
      }

      // Can only edit COMMENT events
      if (event.type !== SubmissionEventType.COMMENT) {
        throw userError('BAD_REQUEST', 'Only comments can be edited')
      }

      // Only author can edit their own comments
      if (event.userId !== ctx.user.id) {
        throw userError('FORBIDDEN', 'You can only edit your own comments')
      }

      const oldContent = event.content ?? ''
      const newContent = input.content

      // Update the comment
      const updatedEvent = await ctx.prisma.submissionEvent.update({
        where: { id: input.eventId },
        data: { content: newContent },
        include: {
          user: {
            select: { id: true, name: true, image: true, username: true },
          },
        },
      })

      // Find newly @mentioned users (in new content but not in old content)
      const oldMentionedUserIds = await resolveMentionedUserIds(
        ctx.prisma,
        oldContent,
      )
      const newMentionedUserIds = await resolveMentionedUserIds(
        ctx.prisma,
        newContent,
      )
      const newlyMentionedUserIds = newMentionedUserIds.filter(
        (id) => !oldMentionedUserIds.includes(id),
      )

      // Notify newly mentioned users with MENTION type
      if (newlyMentionedUserIds.length > 0) {
        createNotifications({
          prisma: ctx.prisma,
          type: NotificationType.SUBMISSION_MENTION,
          referenceType: NotificationReferenceType.SUBMISSION,
          referenceId: event.submissionId,
          actorId: ctx.user.id,
          recipientIds: newlyMentionedUserIds,
        }).catch((err) => {
          console.error(
            'Failed to create mention notifications for edited comment:',
            err,
          )
        })
      }

      return updatedEvent
    }),
})
