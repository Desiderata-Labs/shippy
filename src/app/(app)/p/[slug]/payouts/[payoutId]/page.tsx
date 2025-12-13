import type { Metadata } from 'next'
import { prisma } from '@/lib/db/server'
import { PayoutDetailContent } from './_content'

interface PayoutDetailPageProps {
  params: Promise<{ slug: string; payoutId: string }>
}

export async function generateMetadata({
  params,
}: PayoutDetailPageProps): Promise<Metadata> {
  const { payoutId } = await params

  const payout = await prisma.payout.findUnique({
    where: { id: payoutId },
    select: { periodLabel: true },
  })

  if (!payout) {
    return { title: 'Payout Not Found' }
  }

  return {
    title: payout.periodLabel,
  }
}

export default function PayoutDetailPage() {
  return <PayoutDetailContent />
}
