/**
 * Layout for marketing pages (landing page, etc.)
 * These pages have their own styling and don't use the app frame.
 */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
