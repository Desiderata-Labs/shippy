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
  title: 'Privacy Policy',
}

export default async function PrivacyPage() {
  const markdown = await readLegalMarkdown('privacy')

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
            <BreadcrumbPage>Privacy Policy</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <Markdown markdown={markdown} proseSize="sm" />
    </div>
  )
}
