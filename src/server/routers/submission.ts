import {
  BountyStatus,
  ClaimStatus,
  NotificationReferenceType,
  NotificationType,
  SubmissionEventType,
  SubmissionStatus,
} from '@/lib/db/types'
import {
  formatAutoApproveComment,
  getInstallationOctokit,
} from '@/lib/github/server'
import { nanoId } from '@/lib/nanoid/zod'
import { routes } from '@/lib/routes'
import {
  createNotifications,
  getSubmissionCommentRecipients,
  resolveMentionedUserIds,
} from './notification'
import { protectedProcedure, router, userError } from '@/server/trpc'
import { Prisma } from '@prisma/client'
import { z } from 'zod/v4'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://shippy.sh'

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

      // Notify founder about new submission (if not draft)
      if (!input.isDraft) {
        createNotifications({
          prisma: ctx.prisma,
          type: NotificationType.SUBMISSION_CREATED,
          referenceType: NotificationReferenceType.SUBMISSION,
          referenceId: submission.id,
          actorId: ctx.user.id,
          recipientIds: [bounty.project.founderId],
        }).catch((err) => {
          console.error('Failed to create submission notification:', err)
        })
      }

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
          const bountyDisplayId = `${project.projectKey}-${submission.bounty.number}`

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

          // Notify contributor about approval
          createNotifications({
            prisma: ctx.prisma,
            type: NotificationType.SUBMISSION_APPROVED,
            referenceType: NotificationReferenceType.SUBMISSION,
            referenceId: submission.id,
            actorId: ctx.user.id,
            recipientIds: [submission.userId],
          }).catch((err) => {
            console.error('Failed to create approval notification:', err)
          })

          // Post GitHub comment if this submission is linked to a PR
          notifyGitHubPR({
            prisma: ctx.prisma,
            submissionId: submission.id,
            bountyIdentifier: bountyDisplayId,
            bountyTitle: submission.bounty.title,
            bountyUrl: `${APP_URL}${routes.project.bountyDetail({ slug: project.slug, bountyId: submission.bountyId })}`,
            pointsAwarded,
          }).catch((err) => {
            console.error('Failed to notify GitHub PR:', err)
          })

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

          // Notify contributor about rejection
          createNotifications({
            prisma: ctx.prisma,
            type: NotificationType.SUBMISSION_REJECTED,
            referenceType: NotificationReferenceType.SUBMISSION,
            referenceId: submission.id,
            actorId: ctx.user.id,
            recipientIds: [submission.userId],
          }).catch((err) => {
            console.error('Failed to create rejection notification:', err)
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

/**
 * Post a comment to GitHub PR when a submission is approved
 */
async function notifyGitHubPR({
  prisma,
  submissionId,
  bountyIdentifier,
  bountyTitle,
  bountyUrl,
  pointsAwarded,
}: {
  prisma:
    | Prisma.TransactionClient
    | typeof import('@prisma/client').PrismaClient.prototype
  submissionId: string
  bountyIdentifier: string
  bountyTitle: string
  bountyUrl: string
  pointsAwarded: number
}) {
  // Check if this submission has a linked GitHub PR
  const prLink = await prisma.gitHubPRLink.findUnique({
    where: { submissionId },
  })

  if (!prLink) return

  // Get the GitHub connection to find installation ID
  const connection = await prisma.gitHubConnection.findFirst({
    where: { repoId: prLink.repoId },
  })

  if (!connection) return

  try {
    const octokit = await getInstallationOctokit(connection.installationId)
    const [owner, repo] = connection.repoFullName.split('/')

    const comment = formatAutoApproveComment({
      identifier: bountyIdentifier,
      title: bountyTitle,
      points: pointsAwarded,
      status: BountyStatus.COMPLETED,
      url: bountyUrl,
    })

    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: prLink.prNumber,
      body: comment,
    })
  } catch (err) {
    console.error('Failed to post GitHub comment:', err)
  }
}
