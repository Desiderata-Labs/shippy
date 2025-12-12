'use client'

import { useParams } from 'next/navigation'
import { extractNanoIdFromSlug } from '@/lib/nanoid/shared'
import { BountyEditor } from '@/components/bounty/bounty-editor'

export default function EditBountyPage() {
  const params = useParams<{ slug: string; bountyId: string }>()
  // Extract the nanoid from the URL slug (e.g., "grow-audience-TdFKukO9LuJe" -> "TdFKukO9LuJe")
  const bountyId = extractNanoIdFromSlug(params.bountyId)

  return <BountyEditor mode="edit" slug={params.slug} bountyId={bountyId} />
}
