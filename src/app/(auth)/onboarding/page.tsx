'use client'

import { useSession } from '@/lib/auth/react'
import { trpc } from '@/lib/trpc/react'
import { Check, Loader2, X } from 'lucide-react'
import { useCallback, useState } from 'react'
import Link from 'next/link'
import { redirect, useRouter } from 'next/navigation'
import { routes } from '@/lib/routes'
import { slugifyUsername } from '@/lib/username/shared'
import { useDebounce } from '@/hooks/use-debounce'
import { AppButton, AppInput } from '@/components/app'
import { AppBackground } from '@/components/layout/app-background'
import { Label } from '@/components/ui/label'
import { Logo } from '@/components/ui/logo'
import { toast } from 'sonner'

/**
 * Inner component that receives the session and renders the form.
 * This allows us to compute the initial username from the session
 * without needing an effect to set state.
 */
function OnboardingForm({ suggestedUsername }: { suggestedUsername: string }) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Username state - starts with suggestion (computed before this component mounts)
  const [username, setUsername] = useState(suggestedUsername)

  // Debounce username for availability check
  const debouncedUsername = useDebounce(username, 300)

  // Check username availability
  const { data: availabilityData, isLoading: isCheckingAvailability } =
    trpc.user.checkUsernameAvailable.useQuery(
      { username: debouncedUsername },
      {
        enabled: debouncedUsername.length >= 3,
      },
    )

  // Set username mutation
  const setUsernameMutation = trpc.user.setUsername.useMutation({
    onSuccess: () => {
      toast.success('Username set successfully!')
      router.push(routes.dashboard.root())
      router.refresh()
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to set username')
      setIsSubmitting(false)
    },
  })

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()

      if (!availabilityData?.available) {
        toast.error(availabilityData?.error || 'Username is not available')
        return
      }

      setIsSubmitting(true)
      setUsernameMutation.mutate({
        username: username.toLowerCase().trim(),
      })
    },
    [username, availabilityData, setUsernameMutation],
  )

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow lowercase letters, numbers, and dashes
    const value = e.target.value
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .replace(/--+/g, '-') // Prevent multiple consecutive dashes
    setUsername(value)
  }

  // Determine availability status icon
  const renderAvailabilityStatus = () => {
    if (username.length < 3) {
      return null
    }

    if (isCheckingAvailability) {
      return <Loader2 className="size-4 animate-spin text-muted-foreground" />
    }

    if (availabilityData?.available) {
      return <Check className="size-4 text-green-500" />
    }

    return <X className="size-4 text-destructive" />
  }

  const isValid =
    username.length >= 3 &&
    !isCheckingAvailability &&
    availabilityData?.available

  return (
    <div className="rounded-2xl border border-border bg-card p-8 shadow-lg">
      <div className="flex flex-col space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Choose your username
        </h1>
        <p className="text-sm text-muted-foreground">
          This will be your unique identifier on Earn A Slice
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="username">Username</Label>
          <div className="relative">
            <AppInput
              id="username"
              type="text"
              placeholder="your-username"
              value={username}
              onChange={handleUsernameChange}
              required
              disabled={isSubmitting}
              minLength={3}
              maxLength={30}
              className="pr-10"
            />
            <div className="absolute top-1/2 right-3 -translate-y-1/2">
              {renderAvailabilityStatus()}
            </div>
          </div>
          {username.length > 0 && username.length < 3 && (
            <p className="text-xs text-muted-foreground">
              Username must be at least 3 characters
            </p>
          )}
          {availabilityData?.error &&
            username.length >= 3 &&
            !isCheckingAvailability && (
              <p className="text-xs text-destructive">
                {availabilityData.error}
              </p>
            )}
          {availabilityData?.available && username.length >= 3 && (
            <p className="text-xs text-green-600 dark:text-green-400">
              Username is available!
            </p>
          )}
        </div>

        <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Username rules:</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            <li>3-30 characters long</li>
            <li>Lowercase letters, numbers, and dashes only</li>
            <li>Cannot start or end with a dash</li>
          </ul>
        </div>

        <AppButton
          type="submit"
          disabled={!isValid || isSubmitting}
          className="mt-2 h-11"
        >
          {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
          Continue
        </AppButton>
      </form>
    </div>
  )
}

export default function OnboardingPage() {
  const { data: session, isPending: sessionLoading } = useSession()

  // Loading state
  if (sessionLoading) {
    return (
      <AppBackground showHeader={false}>
        <div className="container flex min-h-screen flex-col items-center justify-center">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </AppBackground>
    )
  }

  // Redirect to sign-in if not authenticated
  if (!session) {
    redirect(routes.auth.signIn())
  }

  // Compute suggested username from user's name
  const suggestedUsername = session.user.name
    ? slugifyUsername(session.user.name)
    : ''

  return (
    <AppBackground showHeader={false}>
      <div className="container flex min-h-screen flex-col items-center justify-center px-4 py-12">
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[400px]">
          {/* Logo link */}
          <Link href={routes.home()} className="mx-auto">
            <Logo size="lg" />
          </Link>

          <OnboardingForm suggestedUsername={suggestedUsername} />
        </div>
      </div>
    </AppBackground>
  )
}
