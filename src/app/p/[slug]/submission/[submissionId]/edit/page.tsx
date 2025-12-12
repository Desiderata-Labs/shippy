'use client'

import { useParams } from 'next/navigation'
import { SubmissionEditor } from '@/components/submission/submission-editor'

export default function EditSubmissionPage() {
  const params = useParams<{ slug: string; submissionId: string }>()

  return (
    <SubmissionEditor
      mode="edit"
      slug={params.slug}
      submissionId={params.submissionId}
    />
  )
}
