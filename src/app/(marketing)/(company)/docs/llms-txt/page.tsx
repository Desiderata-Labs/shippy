import type { Metadata } from 'next'
import Link from 'next/link'
import { routes } from '@/lib/routes'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Markdown } from '@/components/ui/markdown'
import { readDocsMarkdown } from '../_lib/read-docs-markdown'

export const runtime = 'nodejs'
export const dynamic = 'force-static'

export const metadata: Metadata = {
  title: 'llms.txt',
  description:
    'LLM-friendly documentation endpoint following the llms.txt standard.',
}

export default async function LlmsTxtPage() {
  const markdown = await readDocsMarkdown('llms-txt')

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={routes.home()}>Home</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={routes.docs.root()}>Docs</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>llms.txt</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <Markdown markdown={markdown} proseSize="sm" />
    </div>
  )
}
