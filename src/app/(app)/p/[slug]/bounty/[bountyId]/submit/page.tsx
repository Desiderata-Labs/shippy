import type { Metadata } from 'next'
import { SubmitWorkContent } from './_content'

export const metadata: Metadata = {
  title: 'Submit Work',
}

export default function SubmitWorkPage() {
  return <SubmitWorkContent />
}
