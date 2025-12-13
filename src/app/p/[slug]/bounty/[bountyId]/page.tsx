import type { Metadata } from 'next'
import { prisma } from '@/lib/db/server'
import { extractNanoIdFromSlug } from '@/lib/nanoid/shared'
import { BountyDetailContent } from './_content'

interface BountyDetailPageProps {
  params: Promise<{ slug: string; bountyId: string }>
}

export async function generateMetadata({
  params,
}: BountyDetailPageProps): Promise<Metadata> {
  const { bountyId: bountySlug } = await params
  const bountyId = extractNanoIdFromSlug(bountySlug)

  const bounty = await prisma.bounty.findUnique({
    where: { id: bountyId },
    select: { title: true },
  })

  if (!bounty) {
    return { title: 'Bounty Not Found' }
  }

  return {
    title: bounty.title,
  }
}

export default function BountyDetailPage() {
  return <BountyDetailContent />
}
