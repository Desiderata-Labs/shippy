'use client'

import { useParams } from 'next/navigation'
import { extractNanoIdFromSlug } from '@/lib/nanoid/shared'
import { SubmissionEditor } from '@/components/submission/submission-editor'

export function SubmitWorkContent() {
  const params = useParams<{ slug: string; bountyId: string }>()
  // Extract the nanoid from the URL slug (e.g., "grow-audience-TdFKukO9LuJe" -> "TdFKukO9LuJe")
  const bountyId = extractNanoIdFromSlug(params.bountyId)

  return (
    <SubmissionEditor mode="create" slug={params.slug} bountyId={bountyId} />
  )
}
