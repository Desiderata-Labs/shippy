import type { Metadata } from 'next'
import { DiscoverContent } from './_components/discover-content'

export const metadata: Metadata = {
  title: 'Discover Projects',
  description:
    'Find projects looking for contributors. Ship work, earn royalties.',
}

export default function DiscoverPage() {
  return <DiscoverContent />
}
