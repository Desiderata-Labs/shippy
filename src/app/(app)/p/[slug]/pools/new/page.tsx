import type { Metadata } from 'next'
import { NewPoolContent } from './_content'

export const metadata: Metadata = {
  title: 'New Pool',
}

export default function NewPoolPage() {
  return <NewPoolContent />
}
