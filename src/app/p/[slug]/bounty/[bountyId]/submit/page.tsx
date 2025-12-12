'use client'

import { useParams } from 'next/navigation'
import { SubmissionEditor } from '@/components/submission/submission-editor'

export default function SubmitWorkPage() {
  const params = useParams<{ slug: string; bountyId: string }>()

  return (
    <SubmissionEditor
      mode="create"
      slug={params.slug}
      bountyId={params.bountyId}
    />
  )
}
