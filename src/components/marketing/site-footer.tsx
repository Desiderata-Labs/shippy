import { PieChart01 } from '@untitled-ui/icons-react'
import Link from 'next/link'

const footerLinks = [
  {
    heading: 'Product',
    links: [
      { label: 'Discover', href: '/discover' },
      { label: 'How It Works', href: '/#how-it-works' },
      { label: 'For Founders', href: '/sign-up' },
      { label: 'For Contributors', href: '/discover' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Blog', href: '/blog' },
      { label: 'Contact', href: '/contact' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { label: 'Terms', href: '/terms' },
      { label: 'Privacy', href: '/privacy' },
    ],
  },
]

const currentYear = new Date().getFullYear()

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-muted/30">
      <div className="mx-auto max-w-6xl px-6 pt-16 pb-8">
        <div className="flex flex-wrap justify-between gap-12">
          {/* Brand */}
          <div className="max-w-xs space-y-4">
            <Link href="/" className="flex items-center gap-2">
              <PieChart01 className="size-6 text-primary" />
              <span className="text-lg font-bold">Earn A Slice</span>
            </Link>
            <p className="text-sm text-muted-foreground">
              Post work you need help with. Contributors who deliver earn
              recurring royalties from your profits.
            </p>
          </div>

          {/* Links */}
          {footerLinks.map((section) => (
            <div key={section.heading} className="space-y-4">
              <div className="text-sm font-semibold">{section.heading}</div>
              <ul className="space-y-3 text-sm text-muted-foreground">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="transition hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-border pt-8 sm:flex-row">
          <div className="text-xs text-muted-foreground">
            © {currentYear} Earn A Slice. All rights reserved.
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Built globally with</span>
            <PieChart01 className="size-4 text-primary" />
          </div>
        </div>
      </div>
    </footer>
  )
}
