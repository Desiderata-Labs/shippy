import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { auth } from '@/lib/auth/server'
import { prisma } from '@/lib/db/server'
import {
  BountyStatus,
  ClaimStatus,
  PayoutRecipientStatus,
  PayoutStatus,
  SubmissionStatus,
} from '@/lib/db/types'
import { ProjectBackground } from './_components/project-background'
import { ProjectHeader } from './_components/project-header'
import { ProjectTabs } from './_components/project-tabs'

interface ProjectPageProps {
  params: Promise<{ slug: string }>
}

async function getProject(slug: string) {
  const project = await prisma.project.findUnique({
    where: { slug },
    include: {
      founder: {
        select: { id: true, name: true, username: true, image: true },
      },
      rewardPool: true,
      bounties: {
        // Always include past bounties (COMPLETED/CLOSED), not just active ones.
        orderBy: [{ createdAt: 'desc' }],
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
          claims: {
            where: {
              status: { in: [ClaimStatus.ACTIVE, ClaimStatus.SUBMITTED] },
            },
            orderBy: { expiresAt: 'asc' },
            select: {
              id: true,
              expiresAt: true,
              user: { select: { id: true, name: true, image: true } },
            },
          },
          submissions: {
            where: {
              status: {
                in: [SubmissionStatus.PENDING, SubmissionStatus.NEEDS_INFO],
              },
            },
            select: { id: true },
          },
        },
      },
      payouts: {
        select: {
          id: true,
          status: true,
          recipients: {
            select: {
              userId: true,
              amountCents: true,
              status: true,
            },
          },
        },
      },
      _count: {
        select: {
          bounties: true,
          payouts: true,
        },
      },
    },
  })

  if (!project) return null

  // Calculate stats from payouts
  const allRecipients = project.payouts.flatMap((p) => p.recipients)
  const uniqueContributorIds = new Set(allRecipients.map((r) => r.userId))
  const contributorCount = uniqueContributorIds.size

  const confirmedRecipients = allRecipients.filter(
    (r) => r.status === PayoutRecipientStatus.CONFIRMED,
  )
  const totalPaidOutCents = confirmedRecipients.reduce(
    (sum, r) => sum + r.amountCents,
    0,
  )

  const verifiedPayoutCount = project.payouts.filter(
    (p) =>
      p.status === PayoutStatus.COMPLETED || p.status === PayoutStatus.SENT,
  ).length

  // Transform bounties to include pendingSubmissions count
  const bountiesWithPendingCount = project.bounties.map((bounty) => ({
    ...bounty,
    _count: {
      ...bounty._count,
      pendingSubmissions: bounty.submissions.length,
    },
  }))

  // Keep active bounties at the top, then past bounties.
  const statusRank: Record<string, number> = {
    [BountyStatus.OPEN]: 0,
    [BountyStatus.CLAIMED]: 1,
    [BountyStatus.COMPLETED]: 2,
    [BountyStatus.CLOSED]: 3,
  }
  bountiesWithPendingCount.sort((a, b) => {
    const rankA = statusRank[a.status] ?? 99
    const rankB = statusRank[b.status] ?? 99
    if (rankA !== rankB) return rankA - rankB
    if (a.points !== b.points) return b.points - a.points
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  return {
    ...project,
    bounties: bountiesWithPendingCount,
    payoutVisibility: project.payoutVisibility,
    stats: {
      contributorCount,
      totalPaidOutCents,
      verifiedPayoutCount,
    },
  }
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { slug } = await params
  const project = await getProject(slug)

  if (!project) {
    notFound()
  }

  // Check if current user is the founder
  const session = await auth.api.getSession({
    headers: await headers(),
  })
  const isFounder = session?.user?.id === project.founderId

  // Only show if public or if user is founder
  if (!project.isPublic && !isFounder) {
    notFound()
  }

  return (
    <ProjectBackground>
      <div className="mx-auto max-w-7xl px-4 py-8">
        <ProjectHeader project={project} isFounder={isFounder} />
        <ProjectTabs project={project} isFounder={isFounder} />
      </div>
    </ProjectBackground>
  )
}
