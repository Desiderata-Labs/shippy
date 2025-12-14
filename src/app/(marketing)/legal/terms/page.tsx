import type { Metadata } from 'next'
import { Markdown } from '@/components/ui/markdown'
import { readLegalMarkdown } from '../_lib/read-legal-markdown'

export const runtime = 'nodejs'
export const dynamic = 'force-static'

export const metadata: Metadata = {
  title: 'Terms of Service',
}

export default async function TermsPage() {
  const markdown = await readLegalMarkdown('terms')

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12">
      <Markdown markdown={markdown} proseSize="sm" />
    </div>
  )
}
