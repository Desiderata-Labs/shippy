'use client'

import {
  ParticleBackground,
  ParticleIntensity,
} from '@/components/marketing/particle-background'
import { Header } from './header'

interface AppBackgroundProps {
  children: React.ReactNode
  /**
   * Whether to show the header. Defaults to false.
   * NOTE: For pages in the (app) route group, the layout handles the header.
   * Only set to true for standalone pages outside the app layout.
   */
  showHeader?: boolean
  /**
   * Whether to show full-page background with particles.
   * Use for standalone pages (auth, error) that aren't in the app layout.
   */
  fullPage?: boolean
}

/**
 * Background wrapper for pages.
 *
 * For pages in the (app) route group: just renders children (layout handles frame/header).
 * For standalone pages (auth, error, not-found): provides full background with particles.
 */
export function AppBackground({
  children,
  showHeader = false,
  fullPage = false,
}: AppBackgroundProps) {
  // For pages inside the (app) layout, just render children
  // The layout handles the dark frame, header, and content container
  if (!fullPage && !showHeader) {
    return <>{children}</>
  }

  // For standalone pages (auth, error, etc.), provide full background
  return (
    <div className="relative min-h-screen">
      {/* Particles */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <ParticleBackground intensity={ParticleIntensity.Subtle} />
      </div>

      {/* Header */}
      {showHeader && <Header />}

      {/* Content */}
      <div className="relative">{children}</div>
    </div>
  )
}
