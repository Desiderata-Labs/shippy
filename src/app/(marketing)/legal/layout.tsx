import { Header } from '@/components/layout/header'
import { SiteFooter } from '@/components/marketing/site-footer'

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <main className="flex min-h-screen flex-col overflow-x-clip">
      <Header padded />
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </main>
  )
}
