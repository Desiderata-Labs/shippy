import type { Metadata } from 'next'
import { IntegrationsContent } from './_content'

export const metadata: Metadata = {
  title: 'Integrations',
}

export default function IntegrationsPage() {
  return <IntegrationsContent />
}
