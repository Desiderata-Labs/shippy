import type { Metadata } from 'next'
import { SubmissionsContent } from './_content'

export const metadata: Metadata = {
  title: 'Pending Submissions',
}

export default function SubmissionsPage() {
  return <SubmissionsContent />
}
