'use client'

import { trpc } from '@/lib/trpc/react'
import { GitMerge, SearchMd } from '@untitled-ui/icons-react'
import { Loader2, Lock } from 'lucide-react'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { routes } from '@/lib/routes'
import { AppButton, AppInput } from '@/components/app'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'

export function IntegrationsContent() {
  const params = useParams<{ slug: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [repoSearch, setRepoSearch] = useState('')

  // Check if we're in repo picker mode
  const pickRepo = searchParams.get('pick_repo') === 'true'
  const installationId = searchParams.get('installation_id')

  const { data, isLoading, error, refetch } =
    trpc.project.getGitHubConnection.useQuery({ slug: params.slug })

  const updateSettings = trpc.project.updateGitHubSettings.useMutation({
    onSuccess: () => {
      toast.success('Settings updated')
      refetch()
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update settings')
    },
  })

  const disconnectGitHub = trpc.project.disconnectGitHub.useMutation({
    onSuccess: () => {
      setIsDisconnecting(false)
      toast.success('GitHub disconnected')
      refetch()
    },
    onError: (error) => {
      setIsDisconnecting(false)
      toast.error(error.message || 'Failed to disconnect GitHub')
    },
  })

  // Repo picker queries/mutations
  const { data: repos, isLoading: reposLoading } =
    trpc.project.listGitHubRepos.useQuery(
      { installationId: parseInt(installationId || '0', 10) },
      { enabled: pickRepo && !!installationId },
    )

  const linkRepo = trpc.project.linkGitHubRepo.useMutation({
    onSuccess: () => {
      toast.success('Repository linked')
      // Clear the picker params and refresh
      router.replace(routes.project.integrations({ slug: params.slug }))
      refetch()
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to link repository')
    },
  })

  // Filter repos by search term
  const filteredRepos = useMemo(() => {
    if (!repos) return []
    if (!repoSearch.trim()) return repos
    const search = repoSearch.toLowerCase()
    return repos.filter((repo) => repo.fullName.toLowerCase().includes(search))
  }, [repos, repoSearch])

  const handleDisconnect = () => {
    if (!data?.projectId) return
    setIsDisconnecting(true)
    disconnectGitHub.mutate({ projectId: data.projectId })
  }

  const handleToggleAutoApprove = (checked: boolean) => {
    if (!data?.projectId) return
    updateSettings.mutate({
      projectId: data.projectId,
      autoApproveOnMerge: checked,
    })
  }

  const handleConnect = () => {
    if (!data?.projectId) return
    // Redirect to GitHub App install flow
    router.push(`/api/github/install?projectId=${data.projectId}`)
  }

  const handleSelectRepo = (repo: { id: number; fullName: string }) => {
    if (!data?.projectId || !installationId) {
      toast.error('Missing project or installation data')
      return
    }
    linkRepo.mutate({
      projectId: data.projectId,
      installationId: parseInt(installationId, 10),
      repoId: repo.id,
      repoFullName: repo.fullName,
    })
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="container max-w-3xl py-8">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Lock className="mb-4 size-12 text-muted-foreground" />
            <h2 className="mb-2 text-lg font-semibold">Access Denied</h2>
            <p className="mb-4 text-center text-muted-foreground">
              {error.message ||
                'You do not have permission to access this page.'}
            </p>
            <AppButton asChild variant="outline">
              <Link href={routes.project.detail({ slug: params.slug })}>
                Back to Project
              </Link>
            </AppButton>
          </CardContent>
        </Card>
      </div>
    )
  }

  const connection = data?.connection

  return (
    <div className="container max-w-3xl py-8">
      {/* Breadcrumb */}
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={routes.project.detail({ slug: params.slug })}>
                {params.slug}
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Integrations</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <h1 className="mb-6 text-2xl font-semibold">Integrations</h1>

      {/* Repo Picker (shown after GitHub auth with multiple repos) */}
      {pickRepo && installationId && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Select a Repository</CardTitle>
            <p className="text-sm text-muted-foreground">
              Choose which repository to link to this project
            </p>
          </CardHeader>
          <CardContent>
            {reposLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : repos && repos.length > 0 ? (
              <div className="space-y-3">
                {/* Search input */}
                <div className="relative">
                  <SearchMd className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <AppInput
                    placeholder="Search repositories..."
                    value={repoSearch}
                    onChange={(e) => setRepoSearch(e.target.value)}
                    className="pl-9"
                    autoFocus
                  />
                </div>

                {/* Repo list */}
                <div className="max-h-[200px] space-y-1.5 overflow-y-auto">
                  {filteredRepos.length > 0 ? (
                    filteredRepos.map((repo) => (
                      <button
                        type="button"
                        key={repo.id}
                        onClick={() =>
                          handleSelectRepo({
                            id: repo.id,
                            fullName: repo.fullName,
                          })
                        }
                        disabled={linkRepo.isPending}
                        className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-2.5 text-left transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <div className="flex items-center gap-2">
                          <GitMerge className="size-4 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            {repo.fullName}
                          </span>
                          {repo.private && (
                            <Lock className="size-3 text-muted-foreground" />
                          )}
                        </div>
                        {linkRepo.isPending && (
                          <Loader2 className="size-4 animate-spin" />
                        )}
                      </button>
                    ))
                  ) : (
                    <p className="py-4 text-center text-sm text-muted-foreground">
                      No repositories match &ldquo;{repoSearch}&rdquo;
                    </p>
                  )}
                </div>

                {repos.length > 10 && (
                  <p className="text-xs text-muted-foreground">
                    Showing {filteredRepos.length} of {repos.length}{' '}
                    repositories
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No repositories found for this installation.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* GitHub Integration (hide when picking a repo) */}
      {!pickRepo && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                <GitMerge className="size-5" />
              </div>
              <div>
                <CardTitle className="text-base">GitHub</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Link PRs to bounties and auto-approve on merge
                </p>
              </div>
            </div>
            {connection ? (
              <AppButton
                variant="outline"
                size="sm"
                className="cursor-pointer"
                onClick={handleDisconnect}
                disabled={isDisconnecting}
              >
                {isDisconnecting ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : null}
                Disconnect
              </AppButton>
            ) : (
              <AppButton
                variant="default"
                size="sm"
                className="cursor-pointer"
                onClick={handleConnect}
              >
                Connect
              </AppButton>
            )}
          </CardHeader>

          {connection && (
            <CardContent className="border-t pt-4">
              <div className="space-y-4">
                {/* Connected repo info */}
                <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                  <div className="text-sm">
                    <span className="text-muted-foreground">
                      Connected to:{' '}
                    </span>
                    <a
                      href={`https://github.com/${connection.repoFullName}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-foreground hover:underline"
                    >
                      {connection.repoFullName}
                    </a>
                  </div>
                </div>

                {/* Auto-approve setting */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label
                      htmlFor="auto-approve"
                      className="text-sm font-medium"
                    >
                      Auto-approve on merge
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Automatically approve submissions when linked PRs are
                      merged
                    </p>
                  </div>
                  <Switch
                    id="auto-approve"
                    checked={connection.autoApproveOnMerge}
                    onCheckedChange={handleToggleAutoApprove}
                    disabled={updateSettings.isPending}
                  />
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Slash Commands Help */}
      {connection && !pickRepo && (
        <div className="mt-6 rounded-lg border border-border bg-muted/30 p-4">
          <h3 className="mb-3 text-sm font-medium">Available Commands</h3>
          <div className="space-y-3 text-sm">
            <div>
              <code className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-xs">
                /bounty 50
              </code>
              <span className="ml-2 text-muted-foreground">
                Create a bounty from an issue or pull request (founder only)
              </span>
            </div>
            <div>
              <code className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-xs">
                /claim
              </code>
              <span className="ml-2 text-muted-foreground">
                Claim the bounty linked to an issue or pull request
              </span>
            </div>
            <div>
              <code className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-xs">
                /claim SHP-123
              </code>
              <span className="ml-2 text-muted-foreground">
                Claim a specific bounty by ID
              </span>
            </div>
            <div>
              <code className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-xs">
                /release SHP-123
              </code>
              <span className="ml-2 text-muted-foreground">
                Release your claim on a bounty
              </span>
            </div>
          </div>
          <div className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">How it works:</span>{' '}
            Reference bounties like{' '}
            <code className="rounded-sm bg-muted px-1 py-0.5 font-mono">
              SHP-123
            </code>{' '}
            in pull request titles or descriptions. When the pull request is
            opened, a submission is created automatically.
            {connection.autoApproveOnMerge
              ? ' When merged, the submission is auto-approved.'
              : ' Merge the pull request, then approve the submission on Shippy.'}
          </div>
        </div>
      )}
    </div>
  )
}
