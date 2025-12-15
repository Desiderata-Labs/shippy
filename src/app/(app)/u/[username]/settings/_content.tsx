'use client'

import { useSession } from '@/lib/auth/react'
import { trpc } from '@/lib/trpc/react'
import { Check, Copy, Key, Loader2, Trash2, X } from 'lucide-react'
import { useCallback, useState } from 'react'
import Link from 'next/link'
import { redirect, useParams, useRouter } from 'next/navigation'
import { formatRelativeTime } from '@/lib/format/relative-time'
import { routes } from '@/lib/routes'
import { cn } from '@/lib/utils'
import { useDebounce } from '@/hooks/use-debounce'
import { AppButton, AppInput } from '@/components/app'
import { AppBackground } from '@/components/layout/app-background'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { Separator } from '@/components/ui/separator'
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
      <div className="mx-auto max-w-3xl p-6">
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 text-sm">
          <Link
            href={routes.user.profile({ username: userData.user.username! })}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            {userData.user.name}
          </Link>
          <span className="text-muted-foreground/50">/</span>
          <span className="text-foreground">Settings</span>
        </div>

        {/* Main form container */}
        <div className="rounded-lg border border-border bg-accent">
          {/* Profile Section */}
          <ProfileSection
            initialName={userData.user.name}
            initialUsername={userData.user.username || ''}
          />

          <Separator />

          {/* MCP Tokens Section */}
          <McpTokensSection />
        </div>
      </div>
    </AppBackground>
  )
}

function ProfileSection({
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
      toast.success('Name updated!')
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
      toast.success('Username updated!')
      utils.user.me.invalidate()
      setIsUpdatingUsername(false)
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
    const value = e.target.value
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .replace(/--+/g, '-')
    setUsername(value)
  }

  const renderUsernameStatus = () => {
    if (!usernameChanged || username.length < 3) return null
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
    <div className="space-y-4 p-4">
      <div className="text-xs font-medium text-muted-foreground">Profile</div>

      {/* Name field */}
      <form onSubmit={handleNameSubmit} className="flex items-center gap-3">
        <label className="w-24 shrink-0 text-sm text-muted-foreground">
          Name
        </label>
        <AppInput
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          required
          disabled={isUpdatingName}
          maxLength={100}
          className="flex-1"
        />
        <AppButton
          type="submit"
          size="sm"
          disabled={!nameChanged || isUpdatingName || name.trim() === ''}
          className={cn(!nameChanged && 'invisible')}
        >
          {isUpdatingName && <Loader2 className="mr-1.5 size-3 animate-spin" />}
          Save
        </AppButton>
      </form>

      {/* Username field */}
      <form onSubmit={handleUsernameSubmit} className="flex items-center gap-3">
        <label className="w-24 shrink-0 text-sm text-muted-foreground">
          Username
        </label>
        <div className="relative flex-1">
          <AppInput
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
        <AppButton
          type="submit"
          size="sm"
          disabled={!usernameChanged || !isUsernameValid || isUpdatingUsername}
          className={cn(!usernameChanged && 'invisible')}
        >
          {isUpdatingUsername && (
            <Loader2 className="mr-1.5 size-3 animate-spin" />
          )}
          Save
        </AppButton>
      </form>

      {/* Username feedback */}
      {usernameChanged && username.length > 0 && username.length < 3 && (
        <p className="ml-27 text-xs text-muted-foreground">
          Username must be at least 3 characters
        </p>
      )}
      {usernameChanged &&
        availabilityData?.error &&
        username.length >= 3 &&
        !isCheckingAvailability && (
          <p className="ml-27 text-xs text-destructive">
            {availabilityData.error}
          </p>
        )}
      {usernameChanged &&
        availabilityData?.available &&
        username.length >= 3 && (
          <p className="ml-27 text-xs text-primary">Username is available!</p>
        )}

      {/* URL preview */}
      <div className="ml-27 rounded-md bg-muted/30 px-3 py-2 text-xs">
        <span className="text-muted-foreground">shippy.sh</span>
        <span className="text-foreground">/u/{username || 'username'}</span>
      </div>
    </div>
  )
}

function CursorConfigBlock({ token }: { token: string }) {
  const [copied, setCopied] = useState(false)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://shippy.sh'

  const config = JSON.stringify(
    {
      mcpServers: {
        shippy: {
          url: `${baseUrl}/api/mcp`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      },
    },
    null,
    2,
  )

  const handleCopy = () => {
    navigator.clipboard.writeText(config)
    setCopied(true)
    toast.success('Config copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <details className="mt-3">
      <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
        Show Cursor config
      </summary>
      <div className="relative mt-2">
        <pre className="overflow-x-auto rounded-md bg-muted/50 p-3 pr-12 text-xs">
          {config}
        </pre>
        <AppButton
          type="button"
          variant="ghost"
          size="sm"
          className="absolute top-2 right-2"
          onClick={handleCopy}
        >
          {copied ? (
            <Check className="size-3.5" />
          ) : (
            <Copy className="size-3.5" />
          )}
        </AppButton>
      </div>
    </details>
  )
}

function McpTokensSection() {
  const utils = trpc.useUtils()
  const [isCreating, setIsCreating] = useState(false)
  const [newTokenName, setNewTokenName] = useState('')
  const [newlyCreatedToken, setNewlyCreatedToken] = useState<string | null>(
    null,
  )
  const [copied, setCopied] = useState(false)
  const [tokenToDelete, setTokenToDelete] = useState<{
    id: string
    name: string
  } | null>(null)

  const { data: tokens, isLoading } = trpc.mcpToken.list.useQuery()

  const createTokenMutation = trpc.mcpToken.create.useMutation({
    onSuccess: (data) => {
      setNewlyCreatedToken(data.rawToken)
      setNewTokenName('')
      setIsCreating(false)
      utils.mcpToken.list.invalidate()
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create token')
    },
  })

  const deleteTokenMutation = trpc.mcpToken.delete.useMutation({
    onSuccess: () => {
      toast.success('Token deleted')
      setTokenToDelete(null)
      utils.mcpToken.list.invalidate()
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete token')
    },
  })

  const handleCreateToken = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTokenName.trim()) return
    createTokenMutation.mutate({ name: newTokenName.trim() })
  }

  const handleCopyToken = () => {
    if (newlyCreatedToken) {
      navigator.clipboard.writeText(newlyCreatedToken)
      setCopied(true)
      toast.success('Token copied!')
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleDeleteToken = (id: string) => {
    deleteTokenMutation.mutate({ id })
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Key className="size-3.5" />
        MCP Access Tokens
      </div>

      {/* Newly created token */}
      {newlyCreatedToken && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
          <p className="mb-2 text-sm font-medium text-primary">
            Token created! Copy it now — you won&apos;t see it again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-sm bg-muted px-3 py-2 font-mono text-xs break-all">
              {newlyCreatedToken}
            </code>
            <AppButton
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyToken}
            >
              {copied ? (
                <Check className="size-4" />
              ) : (
                <Copy className="size-4" />
              )}
            </AppButton>
          </div>
          <CursorConfigBlock token={newlyCreatedToken} />
          <AppButton
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={() => setNewlyCreatedToken(null)}
          >
            Done
          </AppButton>
        </div>
      )}

      {/* Create form */}
      {!newlyCreatedToken && (
        <>
          {isCreating ? (
            <form
              onSubmit={handleCreateToken}
              className="flex items-center gap-3"
            >
              <AppInput
                value={newTokenName}
                onChange={(e) => setNewTokenName(e.target.value)}
                placeholder="Token name (e.g., Cursor on MacBook)"
                maxLength={100}
                autoFocus
                className="flex-1"
              />
              <AppButton
                type="submit"
                size="sm"
                disabled={!newTokenName.trim() || createTokenMutation.isPending}
              >
                {createTokenMutation.isPending && (
                  <Loader2 className="mr-1.5 size-3 animate-spin" />
                )}
                Generate
              </AppButton>
              <AppButton
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsCreating(false)
                  setNewTokenName('')
                }}
              >
                Cancel
              </AppButton>
            </form>
          ) : (
            <AppButton
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCreating(true)}
            >
              <Key className="mr-1.5 size-3.5" />
              Generate New Token
            </AppButton>
          )}
        </>
      )}

      {/* Token list */}
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : tokens && tokens.length > 0 ? (
        <div className="space-y-1">
          {tokens.map((token) => (
            <div
              key={token.id}
              className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{token.name}</p>
                <p className="text-xs text-muted-foreground">
                  Created {formatRelativeTime(token.createdAt)}
                  {token.lastUsedAt && (
                    <> · Last used {formatRelativeTime(token.lastUsedAt)}</>
                  )}
                </p>
              </div>
              <AppButton
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() =>
                  setTokenToDelete({ id: token.id, name: token.name })
                }
              >
                <Trash2 className="size-4" />
              </AppButton>
            </div>
          ))}

          <ConfirmModal
            open={!!tokenToDelete}
            onClose={() => setTokenToDelete(null)}
            title="Delete token?"
            description={`This will permanently delete "${tokenToDelete?.name}". Any MCP clients using it will lose access.`}
            confirmText="Delete"
            variant="destructive"
            onConfirm={() => {
              if (tokenToDelete) handleDeleteToken(tokenToDelete.id)
            }}
            isLoading={deleteTokenMutation.isPending}
          />
        </div>
      ) : (
        !newlyCreatedToken &&
        !isCreating && (
          <p className="text-sm text-muted-foreground">
            No tokens yet. Generate one to connect Cursor or other MCP clients.
          </p>
        )
      )}

      {/* Info */}
      <div className="rounded-md bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">What is MCP?</span> The
        Model Context Protocol lets AI assistants read your bounties directly in
        your IDE.{' '}
        <a
          href="https://modelcontextprotocol.io/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          Learn more →
        </a>
      </div>
    </div>
  )
}

function SettingsSkeleton() {
  return (
    <AppBackground>
      <div className="mx-auto max-w-3xl p-6">
        <div className="mb-6">
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="rounded-lg border border-border bg-accent">
          <div className="space-y-4 p-4">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
          <Separator />
          <div className="space-y-4 p-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </div>
    </AppBackground>
  )
}
