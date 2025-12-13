import type { Metadata } from 'next'
import { EditSubmissionContent } from './_content'

export const metadata: Metadata = {
  title: 'Edit Submission',
}

export default function EditSubmissionPage() {
  return <EditSubmissionContent />
}
