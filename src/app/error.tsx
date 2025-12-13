'use client'

import { useEffect } from 'react'
import { AppBackground } from '@/components/layout/app-background'
import { ErrorState } from '@/components/ui/error-state'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: ErrorProps) {
  // Log the error to console in development
  useEffect(() => {
    console.error('Global error:', error)
  }, [error])

  return (
    <AppBackground fullPage>
      <div className="flex min-h-[calc(100vh-80px)] items-center justify-center px-4">
        <ErrorState errorId={error.digest} onRetry={reset} />
      </div>
    </AppBackground>
  )
}
