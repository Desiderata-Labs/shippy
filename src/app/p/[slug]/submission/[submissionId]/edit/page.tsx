'use client'

import { useParams } from 'next/navigation'
import { extractNanoIdFromSlug } from '@/lib/nanoid/shared'
import { SubmissionEditor } from '@/components/submission/submission-editor'

export default function EditSubmissionPage() {
  const params = useParams<{ slug: string; submissionId: string }>()
  // Extract the nanoid from the URL slug (e.g., "bounty-title-TdFKukO9LuJe" -> "TdFKukO9LuJe")
  const submissionId = extractNanoIdFromSlug(params.submissionId)

  return (
    <SubmissionEditor
      mode="edit"
      slug={params.slug}
      submissionId={submissionId}
    />
  )
}
