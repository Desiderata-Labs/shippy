import type { Metadata } from 'next'
import { NewPayoutContent } from './_content'

export const metadata: Metadata = {
  title: 'New Payout',
}

export default function NewPayoutPage() {
  return <NewPayoutContent />
}
