import { File01 } from '@untitled-ui/icons-react'
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
import { DOCS } from '@/../docs/config'

export const metadata: Metadata = {
  title: 'Documentation',
  description: 'Shippy documentation and guides.',
}

// Map doc IDs to route functions
const docRoutes: Record<string, () => string> = {
  'mcp-installation': routes.docs.mcpInstallation,
}

const docs = DOCS.map((doc) => ({
  ...doc,
  href: docRoutes[doc.id]?.() ?? `/docs/${doc.id}`,
}))

export default function DocsPage() {
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
            <BreadcrumbPage>Documentation</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Documentation</h1>
        <p className="mt-2 text-muted-foreground">
          Guides and references for using Shippy.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {docs.map((doc) => (
          <Link
            key={doc.href}
            href={doc.href}
            className="group rounded-lg border border-border bg-card p-6 transition-colors hover:border-primary/50 hover:bg-accent"
          >
            <div className="flex items-start gap-4">
              <div className="rounded-md bg-primary/10 p-2 text-primary">
                <File01 className="size-5" />
              </div>
              <div className="flex-1">
                <h2 className="font-semibold group-hover:text-primary">
                  {doc.title}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {doc.description}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
