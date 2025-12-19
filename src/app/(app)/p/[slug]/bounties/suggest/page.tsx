import type { Metadata } from 'next'
import { SuggestBountyContent } from './_content'

export const metadata: Metadata = {
  title: 'Suggest Bounty',
}

export default function SuggestBountyPage() {
  return <SuggestBountyContent />
}
