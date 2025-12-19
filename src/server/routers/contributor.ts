import { PayoutRecipientStatus, SubmissionStatus } from '@/lib/db/types'
import { nanoId } from '@/lib/nanoid/zod'
import { protectedProcedure, publicProcedure, router } from '@/server/trpc'
import { z } from 'zod/v4'

export const contributorRouter = router({
  /**
   * Get contributors for a project (auto-computed from approved submissions)
   */
  getByProject: publicProcedure
    .input(z.object({ projectId: nanoId() }))
    .query(async ({ ctx, input }) => {
      // Get all approved submissions for this project
      const submissions = await ctx.prisma.submission.findMany({
        where: {
          bounty: { projectId: input.projectId },
          status: SubmissionStatus.APPROVED,
          pointsAwarded: { not: null },
        },
        select: {
          userId: true,
          pointsAwarded: true,
          user: { select: { id: true, name: true, image: true } },
        },
      })

      // Get lifetime earnings for each contributor
      const payoutRecipients = await ctx.prisma.payoutRecipient.findMany({
        where: {
          payout: { projectId: input.projectId },
          status: PayoutRecipientStatus.CONFIRMED,
        },
        select: {
          userId: true,
          amountCents: true,
        },
      })

      // Aggregate points by user
      const contributorMap = new Map<
        string,
        {
          userId: string
          userName: string
          userImage: string | null
          points: number
          lifetimeEarningsCents: number
        }
      >()

      for (const sub of submissions) {
        const existing = contributorMap.get(sub.userId)
        if (existing) {
          existing.points += sub.pointsAwarded ?? 0
        } else {
          contributorMap.set(sub.userId, {
            userId: sub.userId,
            userName: sub.user.name,
            userImage: sub.user.image,
            points: sub.pointsAwarded ?? 0,
            lifetimeEarningsCents: 0,
          })
        }
      }

      // Add lifetime earnings
      for (const recipient of payoutRecipients) {
        const contributor = contributorMap.get(recipient.userId)
        if (contributor) {
          contributor.lifetimeEarningsCents += Number(recipient.amountCents)
        }
      }

      // Calculate percentages and sort
      const totalPoints = Array.from(contributorMap.values()).reduce(
        (sum, c) => sum + c.points,
        0,
      )

      const contributors = Array.from(contributorMap.values())
        .map((c) => ({
          ...c,
          sharePercent: totalPoints > 0 ? (c.points / totalPoints) * 100 : 0,
        }))
        .sort((a, b) => b.points - a.points)

      return {
        contributors,
        totalPoints,
      }
    }),

  /**
   * Get contributor dashboard data for current user
   */
  myDashboard: protectedProcedure.query(async ({ ctx }) => {
    // Get all projects where user has points
    const submissions = await ctx.prisma.submission.findMany({
      where: {
        userId: ctx.user.id,
        status: SubmissionStatus.APPROVED,
        pointsAwarded: { not: null },
      },
      include: {
        bounty: {
          include: {
            project: {
              include: {
                rewardPools: {
                  where: { isDefault: true },
                  take: 1,
                },
              },
            },
          },
        },
      },
    })

    // Get all payouts for user
    const payoutRecipients = await ctx.prisma.payoutRecipient.findMany({
      where: { userId: ctx.user.id },
      include: {
        payout: {
          include: {
            project: {
              select: { id: true, name: true, slug: true, logoUrl: true },
            },
          },
        },
      },
      orderBy: { payout: { periodEnd: 'desc' } },
    })

    // Aggregate by project
    const projectMap = new Map<
      string,
      {
        projectId: string
        projectName: string
        projectSlug: string
        projectLogoUrl: string | null
        points: number
        lifetimeEarningsCents: number
        pendingPayouts: number
      }
    >()

    for (const sub of submissions) {
      const projectId = sub.bounty.projectId
      const existing = projectMap.get(projectId)
      if (existing) {
        existing.points += sub.pointsAwarded ?? 0
      } else {
        projectMap.set(projectId, {
          projectId,
          projectName: sub.bounty.project.name,
          projectSlug: sub.bounty.project.slug,
          projectLogoUrl: sub.bounty.project.logoUrl,
          points: sub.pointsAwarded ?? 0,
          lifetimeEarningsCents: 0,
          pendingPayouts: 0,
        })
      }
    }

    // Add payout data
    for (const recipient of payoutRecipients) {
      const projectId = recipient.payout.projectId
      const existing = projectMap.get(projectId)
      if (existing) {
        if (recipient.status === PayoutRecipientStatus.CONFIRMED) {
          existing.lifetimeEarningsCents += Number(recipient.amountCents)
        } else if (recipient.status === PayoutRecipientStatus.PENDING) {
          existing.pendingPayouts += 1
        }
      }
    }

    // Calculate totals
    const projects = Array.from(projectMap.values())
    const totalPointsAllProjects = projects.reduce(
      (sum, p) => sum + p.points,
      0,
    )
    const totalLifetimeEarnings = projects.reduce(
      (sum, p) => sum + p.lifetimeEarningsCents,
      0,
    )
    const totalPendingPayouts = projects.reduce(
      (sum, p) => sum + p.pendingPayouts,
      0,
    )

    // Recent payouts - serialize BigInt fields for client consumption
    const recentPayouts = payoutRecipients.slice(0, 5).map((r) => ({
      ...r,
      amountCents: Number(r.amountCents),
      payout: {
        ...r.payout,
        reportedProfitCents: Number(r.payout.reportedProfitCents),
        poolAmountCents: Number(r.payout.poolAmountCents),
        platformFeeCents: Number(r.payout.platformFeeCents),
      },
    }))

    return {
      projects,
      totalPointsAllProjects,
      totalLifetimeEarnings,
      totalPendingPayouts,
      recentPayouts,
    }
  }),
})
