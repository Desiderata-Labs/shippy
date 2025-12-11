'use client'

import {
  ParticleBackground,
  ParticleIntensity,
} from '@/components/marketing/particle-background'
import { AppHeader } from './app-header'

interface AppBackgroundProps {
  children: React.ReactNode
  /** Whether to show the header. Defaults to true. */
  showHeader?: boolean
}

/**
 * Shared background for all app pages (non-landing).
 * Includes AppHeader, subtle particle animation, and gradient background.
 */
export function AppBackground({
  children,
  showHeader = true,
}: AppBackgroundProps) {
  return (
    <div className="relative min-h-screen">
      {/* Background gradient */}
      <div className="pointer-events-none fixed inset-0 -z-20 bg-linear-to-b from-background via-background to-muted/20" />

      {/* Subtle grid pattern */}
      <div className="bg-grid-pattern-fade pointer-events-none fixed inset-0 -z-10 opacity-50" />

      {/* Particles */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <ParticleBackground intensity={ParticleIntensity.Subtle} />
      </div>

      {/* Header */}
      {showHeader && <AppHeader />}

      {/* Content */}
      <div className="relative">{children}</div>
    </div>
  )
}
