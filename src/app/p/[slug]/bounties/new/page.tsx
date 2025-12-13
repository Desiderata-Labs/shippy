import type { Metadata } from 'next'
import { NewBountyContent } from './_content'

export const metadata: Metadata = {
  title: 'New Bounty',
}

export default function NewBountyPage() {
  return <NewBountyContent />
}
