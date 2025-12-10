import { BountyStatus, ClaimStatus, SubmissionStatus } from '@/lib/db/types'
import { protectedProcedure, router } from '@/server/trpc'
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

const reviewSubmissionSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(['approve', 'reject', 'requestInfo']),
  note: z.string().optional(),
  pointsAwarded: z.number().int().min(0).optional(), // Can override default points
})

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
          _count: { select: { messages: true } },
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
          messages: {
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
          messages: {
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

      // Can't submit to your own project
      if (bounty.project.founderId === ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You cannot submit to your own bounties',
        })
      }

      // Check if user has an active claim
      const claim = await ctx.prisma.bountyClaim.findUnique({
        where: {
          bountyId_userId: {
            bountyId: input.bountyId,
            userId: ctx.user.id,
          },
        },
      })

      if (!claim || claim.status !== ClaimStatus.ACTIVE) {
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

      // Can only edit if not yet approved/rejected
      if (
        submission.status === SubmissionStatus.APPROVED ||
        submission.status === SubmissionStatus.REJECTED
      ) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot edit a finalized submission',
        })
      }

      return ctx.prisma.submission.update({
        where: { id },
        data,
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

      switch (input.action) {
        case 'approve': {
          const pointsAwarded = input.pointsAwarded ?? submission.bounty.points

          // Update submission
          await ctx.prisma.submission.update({
            where: { id: input.id },
            data: {
              status: SubmissionStatus.APPROVED,
              pointsAwarded,
              approvedAt: now,
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

          // Add approval message if note provided
          if (input.note) {
            await ctx.prisma.submissionMessage.create({
              data: {
                submissionId: input.id,
                userId: ctx.user.id,
                content: `✅ Approved — ${pointsAwarded} points awarded\n\n${input.note}`,
              },
            })
          }

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

          // Add rejection message
          if (input.note) {
            await ctx.prisma.submissionMessage.create({
              data: {
                submissionId: input.id,
                userId: ctx.user.id,
                content: `❌ Rejected\n\n${input.note}`,
              },
            })
          }

          break
        }

        case 'requestInfo': {
          await ctx.prisma.submission.update({
            where: { id: input.id },
            data: { status: SubmissionStatus.NEEDS_INFO },
          })

          // Add info request message
          if (input.note) {
            await ctx.prisma.submissionMessage.create({
              data: {
                submissionId: input.id,
                userId: ctx.user.id,
                content: `ℹ️ More information needed\n\n${input.note}`,
              },
            })
          }

          break
        }
      }

      return { success: true }
    }),

  /**
   * Add a message to a submission thread
   */
  addMessage: protectedProcedure
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

      // Only submitter or founder can add messages
      const isSubmitter = submission.userId === ctx.user.id
      const isFounder = submission.bounty.project.founderId === ctx.user.id

      if (!isSubmitter && !isFounder) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Access denied' })
      }

      return ctx.prisma.submissionMessage.create({
        data: {
          submissionId: input.submissionId,
          userId: ctx.user.id,
          content: input.content,
        },
        include: {
          user: { select: { id: true, name: true, image: true } },
        },
      })
    }),
})
