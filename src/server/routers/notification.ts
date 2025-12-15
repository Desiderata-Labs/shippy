import {
  BountyEventType,
  NotificationReferenceType,
  NotificationType,
  SubmissionEventType,
} from '@/lib/db/types'
import { routes } from '@/lib/routes'
import { protectedProcedure, router } from '@/server/trpc'
import { z } from 'zod/v4'

/**
 * Max notifications to return in list query
 */
const NOTIFICATIONS_LIMIT = 20

export const notificationRouter = router({
  /**
   * Get recent notifications for the current user
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const notifications = await ctx.prisma.notification.findMany({
      where: { userId: ctx.user.id },
      orderBy: { createdAt: 'desc' },
      take: NOTIFICATIONS_LIMIT,
      include: {
        actor: {
          select: { id: true, name: true, image: true, username: true },
        },
      },
    })

    // Enrich with reference data (bounty title, submission bounty title, etc.)
    const enriched = await Promise.all(
      notifications.map(async (notification) => {
        let referenceTitle: string | null = null
        let referenceUrl: string | null = null

        if (notification.referenceType === NotificationReferenceType.BOUNTY) {
          const bounty = await ctx.prisma.bounty.findUnique({
            where: { id: notification.referenceId },
            select: {
              title: true,
              project: { select: { slug: true } },
            },
          })
          if (bounty) {
            referenceTitle = bounty.title
            referenceUrl = routes.project.bountyDetail({
              slug: bounty.project.slug,
              bountyId: notification.referenceId,
              title: bounty.title,
            })
          }
        } else if (
          notification.referenceType === NotificationReferenceType.SUBMISSION
        ) {
          const submission = await ctx.prisma.submission.findUnique({
            where: { id: notification.referenceId },
            select: {
              bounty: {
                select: {
                  id: true,
                  title: true,
                  project: { select: { slug: true } },
                },
              },
            },
          })
          if (submission) {
            referenceTitle = submission.bounty.title
            referenceUrl = routes.project.submissionDetail({
              slug: submission.bounty.project.slug,
              submissionId: notification.referenceId,
              title: submission.bounty.title,
            })
          }
        }

        return {
          ...notification,
          referenceTitle,
          referenceUrl,
        }
      }),
    )

    return enriched
  }),

  /**
   * Get count of unread notifications
   */
  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    const count = await ctx.prisma.notification.count({
      where: {
        userId: ctx.user.id,
        readAt: null,
      },
    })

    return { count }
  }),

  /**
   * Mark all notifications as read
   */
  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.prisma.notification.updateMany({
      where: {
        userId: ctx.user.id,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    })

    return { success: true }
  }),

  /**
   * Mute a thread (stop receiving notifications for it)
   */
  muteThread: protectedProcedure
    .input(
      z.object({
        referenceType: z.nativeEnum(NotificationReferenceType),
        referenceId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.threadSubscription.upsert({
        where: {
          userId_referenceType_referenceId: {
            userId: ctx.user.id,
            referenceType: input.referenceType,
            referenceId: input.referenceId,
          },
        },
        create: {
          userId: ctx.user.id,
          referenceType: input.referenceType,
          referenceId: input.referenceId,
          muted: true,
        },
        update: {
          muted: true,
        },
      })

      return { success: true }
    }),

  /**
   * Unmute a thread (resume receiving notifications for it)
   */
  unmuteThread: protectedProcedure
    .input(
      z.object({
        referenceType: z.nativeEnum(NotificationReferenceType),
        referenceId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.threadSubscription.upsert({
        where: {
          userId_referenceType_referenceId: {
            userId: ctx.user.id,
            referenceType: input.referenceType,
            referenceId: input.referenceId,
          },
        },
        create: {
          userId: ctx.user.id,
          referenceType: input.referenceType,
          referenceId: input.referenceId,
          muted: false,
        },
        update: {
          muted: false,
        },
      })

      return { success: true }
    }),
})

// ================================
// Notification Creation Helpers
// ================================

interface CreateNotificationParams {
  prisma: typeof import('@/lib/db/server').prisma
  type: NotificationType
  referenceType: NotificationReferenceType
  referenceId: string
  actorId: string
  recipientIds: string[]
}

/**
 * Create notifications for multiple recipients, filtering out:
 * - The actor (don't notify yourself)
 * - Users who have muted this thread
 */
export async function createNotifications({
  prisma,
  type,
  referenceType,
  referenceId,
  actorId,
  recipientIds,
}: CreateNotificationParams): Promise<void> {
  // Remove actor from recipients (don't notify yourself)
  const filteredRecipients = recipientIds.filter((id) => id !== actorId)

  if (filteredRecipients.length === 0) {
    return
  }

  // Check for muted subscriptions
  const mutedSubscriptions = await prisma.threadSubscription.findMany({
    where: {
      userId: { in: filteredRecipients },
      referenceType,
      referenceId,
      muted: true,
    },
    select: { userId: true },
  })

  const mutedUserIds = new Set(mutedSubscriptions.map((s) => s.userId))
  const finalRecipients = filteredRecipients.filter(
    (id) => !mutedUserIds.has(id),
  )

  if (finalRecipients.length === 0) {
    return
  }

  // Create notifications in bulk
  await prisma.notification.createMany({
    data: finalRecipients.map((userId) => ({
      userId,
      type,
      referenceType,
      referenceId,
      actorId,
    })),
  })
}

/**
 * Get recipient IDs for a bounty comment notification
 */
export async function getBountyCommentRecipients(
  prisma: typeof import('@/lib/db/server').prisma,
  bountyId: string,
): Promise<string[]> {
  // Get bounty with project founder
  const bounty = await prisma.bounty.findUnique({
    where: { id: bountyId },
    select: {
      project: { select: { founderId: true } },
    },
  })

  if (!bounty) {
    return []
  }

  // Get previous commenters on this bounty
  const previousComments = await prisma.bountyEvent.findMany({
    where: {
      bountyId,
      type: BountyEventType.COMMENT,
    },
    select: { userId: true },
  })

  // Build recipient set (automatically dedupes)
  const recipientSet = new Set<string>()

  // Always include founder
  recipientSet.add(bounty.project.founderId)

  // Add previous commenters
  for (const comment of previousComments) {
    recipientSet.add(comment.userId)
  }

  return Array.from(recipientSet)
}

/**
 * Get recipient IDs for a submission comment notification
 */
export async function getSubmissionCommentRecipients(
  prisma: typeof import('@/lib/db/server').prisma,
  submissionId: string,
): Promise<string[]> {
  // Get submission with bounty project founder
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: {
      userId: true, // Submission author
      bounty: {
        select: {
          project: { select: { founderId: true } },
        },
      },
    },
  })

  if (!submission) {
    return []
  }

  // Get previous commenters on this submission
  const previousComments = await prisma.submissionEvent.findMany({
    where: {
      submissionId,
      type: SubmissionEventType.COMMENT,
    },
    select: { userId: true },
  })

  // Build recipient set (automatically dedupes)
  const recipientSet = new Set<string>()

  // Always include founder
  recipientSet.add(submission.bounty.project.founderId)

  // Always include submission author
  recipientSet.add(submission.userId)

  // Add previous commenters
  for (const comment of previousComments) {
    recipientSet.add(comment.userId)
  }

  return Array.from(recipientSet)
}
