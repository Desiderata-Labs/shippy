import {
  BountyClaimMode,
  BountyEventType,
  BountyStatus,
  ClaimStatus,
  DEFAULT_CLAIM_EXPIRY_DAYS,
  NotificationReferenceType,
  NotificationType,
} from '@/lib/db/types'
import { nanoId } from '@/lib/nanoid/zod'
import {
  createNotifications,
  getBountyCommentRecipients,
  resolveMentionedUserIds,
} from './notification'
import {
  approveSuggestion,
  claimBounty,
  closeBounty,
  createBounty,
  rejectSuggestion,
  releaseClaim,
  reopenBounty,
  suggestBounty,
  updateBounty,
} from '@/server/services/bounty'
import {
  protectedProcedure,
  publicProcedure,
  router,
  userError,
} from '@/server/trpc'
import { TRPCError } from '@trpc/server'
import { z } from 'zod/v4'

// Validation schemas
const createBountySchema = z.object({
  id: nanoId().optional(), // Optional pre-generated ID for attachment association
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

const suggestBountySchema = z.object({
  id: nanoId().optional(), // Optional pre-generated ID for attachment association
  projectId: nanoId(),
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  evidenceDescription: z.string().optional(),
})

const approveSuggestionSchema = z.object({
  bountyId: nanoId(),
  points: z.number().int().min(1).nullable().optional(), // null = approve to backlog
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).optional(),
  evidenceDescription: z.string().optional().nullable(),
  labelIds: z.array(nanoId()).optional(),
})

const rejectSuggestionSchema = z.object({
  bountyId: nanoId(),
  reason: z.string().max(1000).optional(),
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
              githubConnection: { select: { repoFullName: true } },
            },
          },
          suggestedBy: {
            select: { id: true, name: true, image: true, username: true },
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
              githubPRLink: true,
              _count: { select: { events: true } },
            },
          },
          githubIssueLink: true,
          events: {
            orderBy: { createdAt: 'asc' },
            include: {
              user: {
                select: { id: true, name: true, image: true, username: true },
              },
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
      // Use the shared create service (wrapped in transaction for atomicity)
      return ctx.prisma.$transaction(async (tx) => {
        const result = await createBounty({
          prisma: tx,
          id: input.id,
          projectId: input.projectId,
          userId: ctx.user.id,
          title: input.title,
          description: input.description,
          points: input.points,
          labelIds: input.labelIds,
          claimMode: input.claimMode,
          claimExpiryDays: input.claimExpiryDays,
          maxClaims: input.maxClaims,
          evidenceDescription: input.evidenceDescription,
        })

        if (!result.success) {
          // Map service errors to tRPC errors
          const errorMap: Record<
            string,
            'NOT_FOUND' | 'FORBIDDEN' | 'BAD_REQUEST'
          > = {
            NOT_FOUND: 'NOT_FOUND',
            FORBIDDEN: 'FORBIDDEN',
            NO_REWARD_POOL: 'BAD_REQUEST',
          }
          throw userError(
            errorMap[result.code] ?? 'BAD_REQUEST',
            result.message,
          )
        }

        // Fetch the full bounty to return (matching previous behavior)
        return tx.bounty.findUniqueOrThrow({
          where: { id: result.bounty.id },
        })
      })
    }),

  /**
   * Update a bounty (founder only)
   */
  update: protectedProcedure
    .input(updateBountySchema)
    .mutation(async ({ ctx, input }) => {
      const { id, labelIds, ...data } = input

      // Use the shared update service (wrapped in transaction for atomicity)
      return ctx.prisma.$transaction(async (tx) => {
        const result = await updateBounty({
          prisma: tx,
          bountyId: id,
          userId: ctx.user.id,
          data: {
            ...data,
            labelIds,
          },
        })

        if (!result.success) {
          // Map service errors to tRPC errors
          const errorMap: Record<
            string,
            'NOT_FOUND' | 'FORBIDDEN' | 'BAD_REQUEST'
          > = {
            NOT_FOUND: 'NOT_FOUND',
            FORBIDDEN: 'FORBIDDEN',
            NO_CHANGES: 'BAD_REQUEST',
            INVALID_POINTS_CHANGE: 'BAD_REQUEST',
          }
          throw userError(
            errorMap[result.code] ?? 'BAD_REQUEST',
            result.message,
          )
        }

        // Fetch the full bounty to return (matching previous behavior)
        return tx.bounty.findUniqueOrThrow({
          where: { id },
        })
      })
    }),

  /**
   * Claim a bounty
   */
  claim: protectedProcedure
    .input(z.object({ bountyId: nanoId() }))
    .mutation(async ({ ctx, input }) => {
      // Use the shared claim service
      const result = await claimBounty({
        prisma: ctx.prisma,
        bountyId: input.bountyId,
        userId: ctx.user.id,
      })

      if (!result.success) {
        // Special handling for AGREEMENT_REQUIRED - include projectId in error
        if (result.code === 'AGREEMENT_REQUIRED') {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: result.message,
            cause: { code: 'AGREEMENT_REQUIRED', projectId: result.projectId },
          })
        }

        // Map service errors to tRPC errors
        const errorMap: Record<
          string,
          'NOT_FOUND' | 'BAD_REQUEST' | 'CONFLICT'
        > = {
          NOT_FOUND: 'NOT_FOUND',
          BACKLOG: 'BAD_REQUEST',
          COMPLETED: 'BAD_REQUEST',
          CLOSED: 'BAD_REQUEST',
          ALREADY_CLAIMED_SINGLE: 'CONFLICT',
          ALREADY_CLAIMED_BY_USER: 'CONFLICT',
          MAX_CLAIMS_REACHED: 'CONFLICT',
          AGREEMENT_NOT_CONFIGURED: 'BAD_REQUEST',
        }
        throw userError(errorMap[result.code] ?? 'BAD_REQUEST', result.message)
      }

      return result.claim
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
      // Use the shared release service
      const result = await releaseClaim({
        prisma: ctx.prisma,
        claimId: input.claimId,
        userId: ctx.user.id,
        reason: input.reason,
      })

      if (!result.success) {
        const errorMap: Record<string, 'NOT_FOUND' | 'FORBIDDEN'> = {
          NOT_FOUND: 'NOT_FOUND',
          FORBIDDEN: 'FORBIDDEN',
        }
        throw userError(errorMap[result.code] ?? 'BAD_REQUEST', result.message)
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

      // Get recipients before creating the comment (so we don't include this comment's author twice)
      // Pass content to include @mentioned users
      const { threadRecipients, mentionedRecipients } =
        await getBountyCommentRecipients(
          ctx.prisma,
          input.bountyId,
          input.content,
        )

      const comment = await ctx.prisma.bountyEvent.create({
        data: {
          bountyId: input.bountyId,
          userId: ctx.user.id,
          type: BountyEventType.COMMENT,
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
        type: NotificationType.BOUNTY_COMMENT,
        referenceType: NotificationReferenceType.BOUNTY,
        referenceId: input.bountyId,
        actorId: ctx.user.id,
        recipientIds: threadRecipients,
      }).catch((err) => {
        console.error('Failed to create bounty comment notifications:', err)
      })

      // Create separate notifications for mentioned-only users
      if (mentionedRecipients.length > 0) {
        createNotifications({
          prisma: ctx.prisma,
          type: NotificationType.BOUNTY_MENTION,
          referenceType: NotificationReferenceType.BOUNTY,
          referenceId: input.bountyId,
          actorId: ctx.user.id,
          recipientIds: mentionedRecipients,
        }).catch((err) => {
          console.error('Failed to create bounty mention notifications:', err)
        })
      }

      return comment
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
          user: {
            select: { id: true, name: true, image: true, username: true },
          },
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
      const event = await ctx.prisma.bountyEvent.findUnique({
        where: { id: input.eventId },
        include: {
          bounty: { include: { project: { select: { founderId: true } } } },
        },
      })

      if (!event) {
        throw userError('NOT_FOUND', 'Event not found')
      }

      // Can only edit COMMENT events
      if (event.type !== BountyEventType.COMMENT) {
        throw userError('BAD_REQUEST', 'Only comments can be edited')
      }

      // Only author can edit their own comments
      if (event.userId !== ctx.user.id) {
        throw userError('FORBIDDEN', 'You can only edit your own comments')
      }

      const oldContent = event.content ?? ''
      const newContent = input.content

      // Update the comment
      const updatedEvent = await ctx.prisma.bountyEvent.update({
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
          type: NotificationType.BOUNTY_MENTION,
          referenceType: NotificationReferenceType.BOUNTY,
          referenceId: event.bountyId,
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
      // Use transaction to wrap the shared service
      return ctx.prisma.$transaction(async (tx) => {
        const result = await closeBounty({
          prisma: tx,
          bountyId: input.bountyId,
          userId: ctx.user.id,
          reason: input.reason,
        })

        if (!result.success) {
          const errorMap: Record<
            string,
            'NOT_FOUND' | 'FORBIDDEN' | 'BAD_REQUEST'
          > = {
            NOT_FOUND: 'NOT_FOUND',
            FORBIDDEN: 'FORBIDDEN',
            ALREADY_COMPLETED: 'BAD_REQUEST',
            ALREADY_CLOSED: 'BAD_REQUEST',
          }
          throw userError(
            errorMap[result.code] ?? 'BAD_REQUEST',
            result.message,
          )
        }

        // Fetch full bounty to return (matching previous behavior)
        return tx.bounty.findUniqueOrThrow({
          where: { id: input.bountyId },
        })
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
      // Use transaction to wrap the shared service
      return ctx.prisma.$transaction(async (tx) => {
        const result = await reopenBounty({
          prisma: tx,
          bountyId: input.bountyId,
          userId: ctx.user.id,
        })

        if (!result.success) {
          const errorMap: Record<
            string,
            'NOT_FOUND' | 'FORBIDDEN' | 'BAD_REQUEST'
          > = {
            NOT_FOUND: 'NOT_FOUND',
            FORBIDDEN: 'FORBIDDEN',
            NOT_CLOSED: 'BAD_REQUEST',
          }
          throw userError(
            errorMap[result.code] ?? 'BAD_REQUEST',
            result.message,
          )
        }

        // Fetch full bounty to return (matching previous behavior)
        return tx.bounty.findUniqueOrThrow({
          where: { id: input.bountyId },
        })
      })
    }),

  /**
   * Suggest a bounty (contributor only)
   * Creates a bounty in SUGGESTED status for founder review
   */
  suggest: protectedProcedure
    .input(suggestBountySchema)
    .mutation(async ({ ctx, input }) => {
      // Use transaction to wrap the shared service
      return ctx.prisma.$transaction(async (tx) => {
        const result = await suggestBounty({
          prisma: tx,
          id: input.id,
          projectId: input.projectId,
          userId: ctx.user.id,
          title: input.title,
          description: input.description,
          evidenceDescription: input.evidenceDescription,
        })

        if (!result.success) {
          const errorMap: Record<
            string,
            'NOT_FOUND' | 'FORBIDDEN' | 'BAD_REQUEST'
          > = {
            NOT_FOUND: 'NOT_FOUND',
            FOUNDER_CANNOT_SUGGEST: 'BAD_REQUEST',
            NO_REWARD_POOL: 'BAD_REQUEST',
          }
          throw userError(
            errorMap[result.code] ?? 'BAD_REQUEST',
            result.message,
          )
        }

        // Fetch the full bounty to return
        return tx.bounty.findUniqueOrThrow({
          where: { id: result.bounty.id },
        })
      })
    }),

  /**
   * Approve a suggested bounty (founder only)
   * Moves from SUGGESTED to BACKLOG or OPEN
   */
  approveSuggestion: protectedProcedure
    .input(approveSuggestionSchema)
    .mutation(async ({ ctx, input }) => {
      // Use transaction to wrap the shared service
      return ctx.prisma.$transaction(async (tx) => {
        const result = await approveSuggestion({
          prisma: tx,
          bountyId: input.bountyId,
          userId: ctx.user.id,
          points: input.points,
          title: input.title,
          description: input.description,
          evidenceDescription: input.evidenceDescription,
          labelIds: input.labelIds,
        })

        if (!result.success) {
          const errorMap: Record<
            string,
            'NOT_FOUND' | 'FORBIDDEN' | 'BAD_REQUEST'
          > = {
            NOT_FOUND: 'NOT_FOUND',
            FORBIDDEN: 'FORBIDDEN',
            NOT_SUGGESTED: 'BAD_REQUEST',
          }
          throw userError(
            errorMap[result.code] ?? 'BAD_REQUEST',
            result.message,
          )
        }

        // Fetch the full bounty to return
        return tx.bounty.findUniqueOrThrow({
          where: { id: input.bountyId },
        })
      })
    }),

  /**
   * Reject a suggested bounty (founder only)
   * Moves from SUGGESTED to CLOSED
   */
  rejectSuggestion: protectedProcedure
    .input(rejectSuggestionSchema)
    .mutation(async ({ ctx, input }) => {
      // Use transaction to wrap the shared service
      return ctx.prisma.$transaction(async (tx) => {
        const result = await rejectSuggestion({
          prisma: tx,
          bountyId: input.bountyId,
          userId: ctx.user.id,
          reason: input.reason,
        })

        if (!result.success) {
          const errorMap: Record<
            string,
            'NOT_FOUND' | 'FORBIDDEN' | 'BAD_REQUEST'
          > = {
            NOT_FOUND: 'NOT_FOUND',
            FORBIDDEN: 'FORBIDDEN',
            NOT_SUGGESTED: 'BAD_REQUEST',
          }
          throw userError(
            errorMap[result.code] ?? 'BAD_REQUEST',
            result.message,
          )
        }

        // Fetch the full bounty to return
        return tx.bounty.findUniqueOrThrow({
          where: { id: input.bountyId },
        })
      })
    }),
})
