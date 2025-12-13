'use client'

import { useSession } from '@/lib/auth/react'
import { trpc } from '@/lib/trpc/react'
import { Check, Loader2, X } from 'lucide-react'
import { useCallback, useState } from 'react'
import { redirect, useParams, useRouter } from 'next/navigation'
import { routes } from '@/lib/routes'
import { useDebounce } from '@/hooks/use-debounce'
import {
  AppButton,
  AppCard,
  AppCardContent,
  AppCardDescription,
  AppCardHeader,
  AppCardTitle,
  AppInput,
} from '@/components/app'
import { AppBackground } from '@/components/layout/app-background'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'

export function UserSettingsContent() {
  const params = useParams<{ username: string }>()
  const { data: session, isPending: sessionLoading } = useSession()

  // Get current user data
  const { data: userData, isLoading: userLoading } = trpc.user.me.useQuery(
    undefined,
    { enabled: !!session },
  )

  // Check if viewing own settings
  const currentUsername = userData?.user?.username
  const isOwnProfile = currentUsername === params.username

  if (sessionLoading || userLoading) {
    return <SettingsSkeleton />
  }

  if (!session) {
    redirect(routes.auth.signIn())
  }

  // Only allow viewing own settings
  if (!isOwnProfile && currentUsername) {
    redirect(routes.user.settings({ username: currentUsername }))
  }

  if (!userData?.user) {
    redirect(routes.dashboard.root())
  }

  return (
    <AppBackground>
      <div className="mx-auto max-w-7xl p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="mt-2 text-muted-foreground">
            Manage your account settings
          </p>
        </div>

        <div className="space-y-6">
          <ProfileForm
            initialName={userData.user.name}
            initialUsername={userData.user.username || ''}
          />
        </div>
      </div>
    </AppBackground>
  )
}

function ProfileForm({
  initialName,
  initialUsername,
}: {
  initialName: string
  initialUsername: string
}) {
  const router = useRouter()
  const utils = trpc.useUtils()

  // Name form state
  const [name, setName] = useState(initialName)
  const [isUpdatingName, setIsUpdatingName] = useState(false)

  // Username form state
  const [username, setUsername] = useState(initialUsername)
  const [isUpdatingUsername, setIsUpdatingUsername] = useState(false)

  // Debounce username for availability check
  const debouncedUsername = useDebounce(username, 300)

  // Check if values have changed
  const nameChanged = name.trim() !== initialName
  const usernameChanged =
    username.toLowerCase().trim() !== initialUsername.toLowerCase()

  // Check username availability
  const { data: availabilityData, isLoading: isCheckingAvailability } =
    trpc.user.checkUsernameAvailable.useQuery(
      { username: debouncedUsername },
      {
        enabled: debouncedUsername.length >= 3 && usernameChanged,
      },
    )

  // Update profile mutation
  const updateProfileMutation = trpc.user.updateProfile.useMutation({
    onSuccess: () => {
      toast.success('Name updated successfully!')
      utils.user.me.invalidate()
      setIsUpdatingName(false)
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update name')
      setIsUpdatingName(false)
    },
  })

  // Update username mutation
  const setUsernameMutation = trpc.user.setUsername.useMutation({
    onSuccess: (data) => {
      toast.success('Username updated successfully!')
      utils.user.me.invalidate()
      setIsUpdatingUsername(false)
      // Redirect to new settings URL with updated username
      if (data.username) {
        router.replace(routes.user.settings({ username: data.username }))
      }
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update username')
      setIsUpdatingUsername(false)
    },
  })

  const handleNameSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!nameChanged || name.trim().length === 0) return

      setIsUpdatingName(true)
      updateProfileMutation.mutate({ name: name.trim() })
    },
    [name, nameChanged, updateProfileMutation],
  )

  const handleUsernameSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!usernameChanged) return

      if (!availabilityData?.available) {
        toast.error(availabilityData?.error || 'Username is not available')
        return
      }

      setIsUpdatingUsername(true)
      setUsernameMutation.mutate({ username: username.toLowerCase().trim() })
    },
    [username, usernameChanged, availabilityData, setUsernameMutation],
  )

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow lowercase letters, numbers, and dashes
    const value = e.target.value
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .replace(/--+/g, '-')
    setUsername(value)
  }

  // Determine availability status icon for username
  const renderUsernameStatus = () => {
    if (!usernameChanged || username.length < 3) {
      return null
    }

    if (isCheckingAvailability) {
      return <Loader2 className="size-4 animate-spin text-muted-foreground" />
    }

    if (availabilityData?.available) {
      return <Check className="size-4 text-primary" />
    }

    return <X className="size-4 text-destructive" />
  }

  const isUsernameValid =
    !usernameChanged ||
    (username.length >= 3 &&
      !isCheckingAvailability &&
      availabilityData?.available)

  return (
    <>
      {/* Name Section */}
      <AppCard>
        <AppCardHeader>
          <AppCardTitle>Display Name</AppCardTitle>
          <AppCardDescription>
            Your name as it appears across the platform
          </AppCardDescription>
        </AppCardHeader>
        <AppCardContent>
          <form onSubmit={handleNameSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <AppInput
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                required
                disabled={isUpdatingName}
                maxLength={100}
              />
            </div>
            <div className="flex justify-end">
              <AppButton
                type="submit"
                disabled={!nameChanged || isUpdatingName || name.trim() === ''}
              >
                {isUpdatingName && (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                )}
                Save Name
              </AppButton>
            </div>
          </form>
        </AppCardContent>
      </AppCard>

      {/* Username Section */}
      <AppCard>
        <AppCardHeader>
          <AppCardTitle>Username</AppCardTitle>
          <AppCardDescription>
            Your unique identifier used in profile and project URLs
          </AppCardDescription>
        </AppCardHeader>
        <AppCardContent>
          <form onSubmit={handleUsernameSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <div className="relative">
                <AppInput
                  id="username"
                  value={username}
                  onChange={handleUsernameChange}
                  placeholder="your-username"
                  required
                  disabled={isUpdatingUsername}
                  minLength={3}
                  maxLength={30}
                  className="pr-10"
                />
                <div className="absolute top-1/2 right-3 -translate-y-1/2">
                  {renderUsernameStatus()}
                </div>
              </div>

              {/* URL Preview */}
              <div className="rounded-md bg-muted/30 px-3 py-2">
                <p className="text-xs text-muted-foreground">
                  Your profile URL will be:
                </p>
                <p className="mt-0.5 font-mono text-sm">
                  <span className="text-muted-foreground">shippy.sh</span>
                  <span className="text-foreground">
                    /u/{username || 'username'}
                  </span>
                </p>
              </div>

              {usernameChanged &&
                username.length > 0 &&
                username.length < 3 && (
                  <p className="text-xs text-muted-foreground">
                    Username must be at least 3 characters
                  </p>
                )}
              {usernameChanged &&
                availabilityData?.error &&
                username.length >= 3 &&
                !isCheckingAvailability && (
                  <p className="text-xs text-destructive">
                    {availabilityData.error}
                  </p>
                )}
              {usernameChanged &&
                availabilityData?.available &&
                username.length >= 3 && (
                  <p className="text-xs text-primary">Username is available!</p>
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

            {/* Warning about changing username */}
            {usernameChanged && (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
                <p className="font-medium">Warning: Changing your username</p>
                <p className="mt-1">
                  This will change your profile URL. Old links to your profile
                  will stop working.
                </p>
              </div>
            )}

            <div className="flex justify-end">
              <AppButton
                type="submit"
                disabled={
                  !usernameChanged || !isUsernameValid || isUpdatingUsername
                }
              >
                {isUpdatingUsername && (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                )}
                Save Username
              </AppButton>
            </div>
          </form>
        </AppCardContent>
      </AppCard>
    </>
  )
}

function SettingsSkeleton() {
  return (
    <AppBackground>
      <div className="mx-auto max-w-7xl p-6">
        <div className="mb-8">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="mt-2 h-5 w-48" />
        </div>
        <div className="space-y-6">
          <AppCard>
            <AppCardHeader>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-64" />
            </AppCardHeader>
            <AppCardContent>
              <Skeleton className="h-10 w-full" />
            </AppCardContent>
          </AppCard>
          <AppCard>
            <AppCardHeader>
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-4 w-72" />
            </AppCardHeader>
            <AppCardContent>
              <Skeleton className="h-10 w-full" />
            </AppCardContent>
          </AppCard>
        </div>
      </div>
    </AppBackground>
  )
}
