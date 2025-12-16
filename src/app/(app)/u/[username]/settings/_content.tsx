'use client'

import { linkSocial, listAccounts, useSession } from '@/lib/auth/react'
import { trpc } from '@/lib/trpc/react'
import { Check, Copy, Key, Loader2, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
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

          {/* Connected Accounts Section */}
          <ConnectedAccountsSection />

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

type LinkedAccount = {
  id: string
  providerId: string
  accountId: string
}

function ConnectedAccountsSection() {
  const [accounts, setAccounts] = useState<LinkedAccount[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLinking, setIsLinking] = useState(false)

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const result = await listAccounts()
        if (result.data) {
          setAccounts(result.data as LinkedAccount[])
        }
      } catch (error) {
        console.error('Failed to fetch accounts:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchAccounts()
  }, [])

  const hasGitHub = accounts.some((a) => a.providerId === 'github')
  const hasGoogle = accounts.some((a) => a.providerId === 'google')

  const handleLinkGitHub = async () => {
    setIsLinking(true)
    try {
      await linkSocial({
        provider: 'github',
        callbackURL: window.location.href,
      })
    } catch {
      toast.error('Failed to link GitHub account')
      setIsLinking(false)
    }
  }

  const handleLinkGoogle = async () => {
    setIsLinking(true)
    try {
      await linkSocial({
        provider: 'google',
        callbackURL: window.location.href,
      })
    } catch {
      toast.error('Failed to link Google account')
      setIsLinking(false)
    }
  }

  return (
    <div className="space-y-4 p-4">
      <div className="text-xs font-medium text-muted-foreground">
        Connected Accounts
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : (
        <div className="space-y-2">
          {/* GitHub */}
          <div className="flex items-center justify-between rounded-md bg-muted/30 px-4 py-3">
            <div className="flex items-center gap-3">
              <svg className="size-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              <div>
                <p className="text-sm font-medium">GitHub</p>
                {hasGitHub && (
                  <p className="text-xs text-muted-foreground">Connected</p>
                )}
              </div>
            </div>
            {hasGitHub ? (
              <Check className="size-4 text-primary" />
            ) : (
              <AppButton
                variant="outline"
                size="sm"
                onClick={handleLinkGitHub}
                disabled={isLinking}
              >
                {isLinking ? (
                  <Loader2 className="mr-1.5 size-3 animate-spin" />
                ) : null}
                Connect
              </AppButton>
            )}
          </div>

          {/* Google */}
          <div className="flex items-center justify-between rounded-md bg-muted/30 px-4 py-3">
            <div className="flex items-center gap-3">
              <svg className="size-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <div>
                <p className="text-sm font-medium">Google</p>
                {hasGoogle && (
                  <p className="text-xs text-muted-foreground">Connected</p>
                )}
              </div>
            </div>
            {hasGoogle ? (
              <Check className="size-4 text-primary" />
            ) : (
              <AppButton
                variant="outline"
                size="sm"
                onClick={handleLinkGoogle}
                disabled={isLinking}
              >
                {isLinking ? (
                  <Loader2 className="mr-1.5 size-3 animate-spin" />
                ) : null}
                Connect
              </AppButton>
            )}
          </div>
        </div>
      )}

      {/* Info */}
      <div className="rounded-md bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Why connect?</span>{' '}
        Linking your GitHub account lets you use slash commands like{' '}
        <code className="rounded-sm bg-muted px-1">/bounty</code> and{' '}
        <code className="rounded-sm bg-muted px-1">/claim</code> directly in
        GitHub issues and PRs.
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
