'use client'

import { useParams } from 'next/navigation'
import { BountyEditor } from '@/components/bounty/bounty-editor'

export function NewBountyContent() {
  const params = useParams<{ slug: string }>()

  return <BountyEditor mode="create" slug={params.slug} />
}
