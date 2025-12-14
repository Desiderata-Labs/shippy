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
import { readLegalMarkdown } from '../_lib/read-legal-markdown'

export const runtime = 'nodejs'
export const dynamic = 'force-static'

export const metadata: Metadata = {
  title: 'Terms of Service',
}

export default async function TermsPage() {
  const markdown = await readLegalMarkdown('terms')

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={routes.home()}>Company</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Terms of Service</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <Markdown markdown={markdown} proseSize="sm" />
    </div>
  )
}
