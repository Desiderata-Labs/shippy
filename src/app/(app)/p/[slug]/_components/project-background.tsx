'use client'

import { AppBackground } from '@/components/layout/app-background'

interface ProjectBackgroundProps {
  children: React.ReactNode
}

/**
 * Client component wrapper for project pages to use AppBackground
 */
export function ProjectBackground({ children }: ProjectBackgroundProps) {
  return <AppBackground>{children}</AppBackground>
}
