import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth/server'
import { prisma } from '@/lib/db/server'
import {
  BountyClaimMode,
  BountyStatus,
  ClaimStatus,
  PayoutStatus,
  PayoutVisibility,
  SubmissionStatus,
} from '@/lib/db/types'
import { NotFoundState } from '@/components/ui/not-found-state'
import { Separator } from '@/components/ui/separator'
import { ProjectBackground } from './_components/project-background'
import { ProjectHeader } from './_components/project-header'
import { ProjectStatsPanel } from './_components/project-stats-panel'
import { ProjectTabs } from './_components/project-tabs'

interface ProjectPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({
  params,
}: ProjectPageProps): Promise<Metadata> {
  const { slug } = await params
  const project = await prisma.project.findUnique({
    where: { slug },
    select: { name: true, tagline: true },
  })

  if (!project) {
    return { title: 'Project Not Found' }
  }

  return {
    title: project.name,
    description: project.tagline || undefined,
  }
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
          // Include pending (for review count) and approved (for assignee) submissions
          submissions: {
            where: {
              status: {
                in: [
                  SubmissionStatus.PENDING,
                  SubmissionStatus.NEEDS_INFO,
                  SubmissionStatus.APPROVED,
                ],
              },
            },
            select: {
              id: true,
              status: true,
              user: { select: { id: true, name: true, image: true } },
            },
          },
        },
      },
      payouts: {
        select: {
          id: true,
          status: true,
          poolAmountCents: true,
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

  // Total paid out = sum of actual amounts distributed to contributors
  // Note: amountCents is BigInt from DB, convert to Number for arithmetic
  const totalPaidOutCents = project.payouts.reduce(
    (sum, p) =>
      sum + p.recipients.reduce((rSum, r) => rSum + Number(r.amountCents), 0),
    0,
  )

  const verifiedPayoutCount = project.payouts.filter(
    (p) =>
      p.status === PayoutStatus.COMPLETED || p.status === PayoutStatus.SENT,
  ).length

  // Transform bounties to include pendingSubmissions count and approved submission
  const bountiesWithPendingCount = project.bounties.map((bounty) => {
    const pendingSubmissions = bounty.submissions.filter(
      (s) =>
        s.status === SubmissionStatus.PENDING ||
        s.status === SubmissionStatus.NEEDS_INFO,
    )
    const approvedSubmission = bounty.submissions.find(
      (s) => s.status === SubmissionStatus.APPROVED,
    )

    return {
      ...bounty,
      status: bounty.status as BountyStatus,
      claimMode: bounty.claimMode as BountyClaimMode,
      // Keep approved submission for assignee display
      approvedSubmission: approvedSubmission ? [approvedSubmission] : [],
      _count: {
        ...bounty._count,
        pendingSubmissions: pendingSubmissions.length,
      },
    }
  })

  // Keep active bounties at the top, then past bounties.
  const statusRank: Record<BountyStatus, number> = {
    [BountyStatus.OPEN]: 0,
    [BountyStatus.CLAIMED]: 1,
    [BountyStatus.COMPLETED]: 2,
    [BountyStatus.CLOSED]: 3,
    [BountyStatus.BACKLOG]: 98,
  }
  bountiesWithPendingCount.sort((a, b) => {
    const rankA = statusRank[a.status] ?? 99
    const rankB = statusRank[b.status] ?? 99
    if (rankA !== rankB) return rankA - rankB
    // Null points (backlog) sort after bounties with points
    const pointsA = a.points ?? -1
    const pointsB = b.points ?? -1
    if (pointsA !== pointsB) return pointsB - pointsA
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  return {
    ...project,
    bounties: bountiesWithPendingCount,
    payoutVisibility: project.payoutVisibility as PayoutVisibility,
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

  // Check if current user is the founder
  const session = await auth.api.getSession({
    headers: await headers(),
  })
  const isFounder = session?.user?.id === project?.founderId

  // Show 404 if project doesn't exist or user doesn't have access
  if (!project || (!project.isPublic && !isFounder)) {
    return (
      <ProjectBackground>
        <div className="mx-auto max-w-7xl p-6">
          <NotFoundState resourceType="project" />
        </div>
      </ProjectBackground>
    )
  }

  return (
    <ProjectBackground>
      <div className="mx-auto max-w-7xl p-6">
        <ProjectHeader project={project} isFounder={isFounder} />

        {/* Main layout with stats sidebar */}
        <div className="grid gap-6 lg:grid-cols-[1fr_auto_280px]">
          {/* Main content - left side */}
          <div className="min-w-0">
            <ProjectTabs project={project} isFounder={isFounder} />
          </div>

          {/* Vertical separator */}
          <Separator orientation="vertical" className="hidden lg:block" />

          {/* Stats sidebar - right side */}
          <div className="hidden lg:block">
            <div className="sticky top-8">
              <ProjectStatsPanel project={project} />
            </div>
          </div>
        </div>
      </div>
    </ProjectBackground>
  )
}
