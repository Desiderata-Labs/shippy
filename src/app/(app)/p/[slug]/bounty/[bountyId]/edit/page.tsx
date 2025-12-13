import type { Metadata } from 'next'
import { EditBountyContent } from './_content'

export const metadata: Metadata = {
  title: 'Edit Bounty',
}

export default function EditBountyPage() {
  return <EditBountyContent />
}
