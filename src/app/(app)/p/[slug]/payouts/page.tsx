import type { Metadata } from 'next'
import { PayoutsContent } from './_content'

export const metadata: Metadata = {
  title: 'Payouts',
}

export default function PayoutsPage() {
  return <PayoutsContent />
}
