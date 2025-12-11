'use client'

import { trpc } from '@/lib/trpc/react'
import { Loader2 } from 'lucide-react'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AppBackground } from '@/components/layout/app-background'

interface RequireUsernameProps {
  children: React.ReactNode
}

/**
 * Wrapper component that ensures the user has a username set.
 * Redirects to onboarding if username is missing.
 */
export function RequireUsername({ children }: RequireUsernameProps) {
  const router = useRouter()
  const { data, isLoading, isError } = trpc.user.me.useQuery()

  useEffect(() => {
    // If user needs onboarding (no username), redirect
    if (!isLoading && data?.needsOnboarding) {
      router.replace('/onboarding')
    }
  }, [data, isLoading, router])

  // Show loading while checking
  if (isLoading) {
    return (
      <AppBackground>
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </AppBackground>
    )
  }

  // If error or needs onboarding, don't render children
  if (isError || data?.needsOnboarding) {
    return (
      <AppBackground>
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </AppBackground>
    )
  }

  return <>{children}</>
}
