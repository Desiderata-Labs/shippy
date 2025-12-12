'use client'

import { useParams } from 'next/navigation'
import { BountyEditor } from '@/components/bounty/bounty-editor'

export default function EditBountyPage() {
  const params = useParams<{ slug: string; bountyId: string }>()

  return (
    <BountyEditor mode="edit" slug={params.slug} bountyId={params.bountyId} />
  )
}
