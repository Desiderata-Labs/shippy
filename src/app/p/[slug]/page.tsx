import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { auth } from '@/lib/auth/server'
import { prisma } from '@/lib/db/server'
import {
  BountyStatus,
  PayoutRecipientStatus,
  PayoutStatus,
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
        select: { id: true, name: true, image: true },
      },
      rewardPool: true,
      bounties: {
        where: {
          status: { in: [BountyStatus.OPEN, BountyStatus.CLAIMED] },
        },
        orderBy: [{ points: 'desc' }, { createdAt: 'desc' }],
        include: {
          _count: {
            select: { claims: true, submissions: true },
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

  return {
    ...project,
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
      <div className="container px-4 py-8">
        <ProjectHeader project={project} isFounder={isFounder} />
        <ProjectTabs project={project} isFounder={isFounder} />
      </div>
    </ProjectBackground>
  )
}
