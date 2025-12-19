'use client'

import { useParams } from 'next/navigation'
import { SuggestionEditor } from '@/components/bounty/suggestion-editor'

export function SuggestBountyContent() {
  const params = useParams<{ slug: string }>()

  return <SuggestionEditor slug={params.slug} />
}
