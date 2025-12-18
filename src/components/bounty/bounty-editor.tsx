'use client'

import { useSession } from '@/lib/auth/react'
import { trpc } from '@/lib/trpc/react'
import {
  Clock,
  PieChart01,
  Plus,
  RefreshCcw01,
  Users01,
} from '@untitled-ui/icons-react'
import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { redirect } from 'next/navigation'
import {
  getAvailableClaimModes,
  getClaimModeInfo,
  supportsMaxClaims,
} from '@/lib/bounty/claim-modes'
import { getLabelColor } from '@/lib/bounty/tag-colors'
import {
  BountyClaimMode,
  BountyStatus,
  DEFAULT_CLAIM_EXPIRY_DAYS,
  generateRandomLabelColor,
} from '@/lib/db/types'
import { ProjectTab, routes } from '@/lib/routes'
import { cn } from '@/lib/utils'
import { AppButton, AppInput } from '@/components/app'
import { AppBackground } from '@/components/layout/app-background'
import { Badge } from '@/components/ui/badge'
import { ErrorState } from '@/components/ui/error-state'
import { MarkdownEditor } from '@/components/ui/markdown-editor'
import { NotFoundState } from '@/components/ui/not-found-state'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { toast } from 'sonner'

interface ProjectLabel {
  id: string
  name: string
  color: string
}

const BOUNTY_TEMPLATES = [
  {
    label: 'Customer referral',
    title: 'Bring in a new customer (90-day retention)',
    description:
      'Refer a new paying customer who stays active for at least 90 days. You will receive points once the customer completes their first 90 days.',
    points: 50,
    labelNames: ['Sales', 'Growth'],
    evidenceDescription:
      'Provide the customer name/company, signup date, and confirmation of their 90-day retention. Screenshots from billing/CRM are helpful.',
  },
  {
    label: 'Case study',
    title: 'Write a case study that converts',
    description:
      'Create a compelling case study featuring one of our customers. The case study should include the problem, solution, and measurable results.',
    points: 30,
    labelNames: ['Content'],
    evidenceDescription:
      'Submit the published case study URL. Bonus points if you can attribute a lead/customer to the case study.',
  },
  {
    label: 'MRR milestone',
    title: 'Hit MRR milestone',
    description:
      'Help us reach our next MRR milestone. This is a team bounty - points will be awarded to all active contributors who helped achieve it.',
    points: 100,
    labelNames: ['Growth'],
    evidenceDescription:
      'MRR milestones are verified by the founder through internal dashboards.',
  },
  {
    label: 'Design',
    title: 'Design improvement',
    description:
      'Improve the design of a specific feature or page. Must be approved and implemented.',
    points: 15,
    labelNames: ['Design'],
    evidenceDescription:
      'Submit your design files (Figma, screenshots) and wait for approval before implementation.',
  },
  {
    label: 'Bug fix',
    title: 'Bug fix or feature implementation',
    description:
      'Fix a reported bug or implement a small feature. Must follow our code standards and pass review.',
    points: 20,
    labelNames: ['Dev'],
    evidenceDescription: 'Submit a link to your merged pull request.',
  },
]

interface BountyEditorProps {
  mode: 'create' | 'edit'
  slug: string
  bountyId?: string // Required for edit mode
}

export function BountyEditor({ mode, slug, bountyId }: BountyEditorProps) {
  const router = useRouter()
  const { data: session, isPending: sessionLoading } = useSession()
  const [isLoading, setIsLoading] = useState(false)
  const [initialized, setInitialized] = useState(mode === 'create')

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [points, setPoints] = useState(25)
  const [isBacklog, setIsBacklog] = useState(false) // Backlog = no points yet
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([])
  const [claimMode, setClaimMode] = useState<BountyClaimMode>(
    BountyClaimMode.SINGLE,
  )
  const [claimExpiryDays, setClaimExpiryDays] = useState<number | ''>(
    DEFAULT_CLAIM_EXPIRY_DAYS,
  )
  const [maxClaims, setMaxClaims] = useState<number | undefined>(undefined)
  const [evidenceDescription, setEvidenceDescription] = useState('')

  // Create label popover state
  const [showCreateLabel, setShowCreateLabel] = useState(false)
  const [newLabelName, setNewLabelName] = useState('')
  const [newLabelColor, setNewLabelColor] = useState(() =>
    generateRandomLabelColor(),
  )

  // Fetch project data
  const {
    data: project,
    isLoading: projectLoading,
    isError: projectError,
    error: projectErrorData,
    refetch: refetchProject,
  } = trpc.project.getBySlug.useQuery(
    { slug },
    { enabled: !!slug, retry: false },
  )

  // Fetch bounty data for edit mode
  const {
    data: bounty,
    isLoading: bountyLoading,
    isError: bountyError,
    error: bountyErrorData,
    refetch: refetchBounty,
  } = trpc.bounty.getById.useQuery(
    { id: bountyId! },
    { enabled: mode === 'edit' && !!bountyId, retry: false },
  )

  // Fetch pool stats
  const { data: poolStats, isLoading: poolStatsLoading } =
    trpc.project.getPoolStats.useQuery(
      { projectId: project?.id ?? '' },
      { enabled: !!project?.id },
    )

  // Fetch project labels
  const { data: labels, isLoading: labelsLoading } =
    trpc.label.getByProject.useQuery(
      { projectId: project?.id ?? '' },
      { enabled: !!project?.id },
    )

  const utils = trpc.useUtils()

  // Initialize form with bounty data in edit mode
  useEffect(() => {
    if (mode === 'edit' && bounty && !initialized) {
      setTitle(bounty.title)
      setDescription(bounty.description)
      // If points is null, this is a backlog bounty
      const bountyIsBacklog = bounty.points === null
      setIsBacklog(bountyIsBacklog)
      setPoints(bounty.points ?? 25) // Default to 25 if null for the slider
      setSelectedLabelIds(bounty.labels.map((l) => l.label.id))
      setClaimMode(bounty.claimMode as BountyClaimMode)
      setClaimExpiryDays(bounty.claimExpiryDays)
      setMaxClaims(bounty.maxClaims ?? undefined)
      setEvidenceDescription(bounty.evidenceDescription ?? '')
      setInitialized(true)
    }
  }, [mode, bounty, initialized])

  const createBounty = trpc.bounty.create.useMutation({
    onSuccess: (newBounty) => {
      toast.success('Bounty created!')
      utils.bounty.getByProject.invalidate({ projectId: project?.id })
      router.push(
        routes.project.bountyDetail({
          slug,
          bountyId: newBounty.id,
          title,
        }),
      )
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const updateBounty = trpc.bounty.update.useMutation({
    onSuccess: () => {
      toast.success('Bounty updated!')
      utils.bounty.getById.invalidate({ id: bountyId })
      utils.bounty.getByProject.invalidate({ projectId: project?.id })
      router.push(
        routes.project.bountyDetail({
          slug,
          bountyId: bountyId!,
          title,
        }),
      )
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const createLabel = trpc.label.create.useMutation({
    onSuccess: (label) => {
      toast.success(`Label "${label.name}" created`)
      utils.label.getByProject.invalidate({ projectId: project?.id })
      setNewLabelName('')
      setNewLabelColor(generateRandomLabelColor())
      setShowCreateLabel(false)
      // Auto-select the new label
      setSelectedLabelIds((prev) => [...prev, label.id])
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  // Loading states
  const isDataLoading =
    sessionLoading ||
    projectLoading ||
    poolStatsLoading ||
    labelsLoading ||
    (mode === 'edit' && bountyLoading) ||
    (mode === 'edit' && !initialized)

  if (isDataLoading) {
    return (
      <AppBackground>
        <div className="mx-auto max-w-7xl p-6">
          <div className="mb-6">
            <Skeleton className="h-5 w-48" />
          </div>
          <Skeleton className="mb-6 h-8 w-48" />
          <div className="grid gap-6 lg:grid-cols-[1fr_auto_280px]">
            <Skeleton className="h-96" />
            <Skeleton className="hidden h-full w-px lg:block" />
            <Skeleton className="h-80" />
          </div>
        </div>
      </AppBackground>
    )
  }

  // Auth check
  if (!session) {
    redirect(routes.auth.signIn())
  }

  // Handle project errors - differentiate between 404/forbidden and other errors
  if (projectError) {
    const isNotFoundOrForbidden =
      projectErrorData?.data?.code === 'NOT_FOUND' ||
      projectErrorData?.data?.code === 'FORBIDDEN' ||
      projectErrorData?.data?.code === 'BAD_REQUEST'
    return (
      <AppBackground>
        <div className="mx-auto max-w-7xl p-6">
          {isNotFoundOrForbidden ? (
            <NotFoundState
              resourceType="project"
              backHref={routes.dashboard.root()}
              backLabel="Back to Dashboard"
            />
          ) : (
            <ErrorState
              message={projectErrorData?.message}
              errorId={projectErrorData?.data?.errorId}
              backHref={routes.dashboard.root()}
              backLabel="Back to Dashboard"
              onRetry={() => refetchProject()}
            />
          )}
        </div>
      </AppBackground>
    )
  }

  // Project not found or user is not the founder
  if (!project || project.founderId !== session.user.id) {
    return (
      <AppBackground>
        <div className="mx-auto max-w-7xl p-6">
          <NotFoundState
            resourceType="project"
            backHref={routes.dashboard.root()}
            backLabel="Back to Dashboard"
          />
        </div>
      </AppBackground>
    )
  }

  // Handle bounty errors in edit mode
  if (mode === 'edit' && bountyError) {
    const isNotFound =
      bountyErrorData?.data?.code === 'NOT_FOUND' ||
      bountyErrorData?.data?.code === 'BAD_REQUEST'
    const bountiesHref = routes.project.detail({
      slug,
      tab: ProjectTab.BOUNTIES,
    })
    return (
      <AppBackground>
        <div className="mx-auto max-w-7xl p-6">
          {isNotFound ? (
            <NotFoundState
              resourceType="bounty"
              backHref={bountiesHref}
              backLabel="Back to Bounties"
            />
          ) : (
            <ErrorState
              message={bountyErrorData?.message}
              errorId={bountyErrorData?.data?.errorId}
              backHref={bountiesHref}
              backLabel="Back to Bounties"
              onRetry={() => refetchBounty()}
            />
          )}
        </div>
      </AppBackground>
    )
  }

  // In edit mode, check bounty exists and belongs to this project
  if (mode === 'edit' && (!bounty || bounty.projectId !== project.id)) {
    return (
      <AppBackground>
        <div className="mx-auto max-w-7xl p-6">
          <NotFoundState
            resourceType="bounty"
            backHref={routes.project.detail({ slug, tab: ProjectTab.BOUNTIES })}
            backLabel="Back to Bounties"
          />
        </div>
      </AppBackground>
    )
  }

  // In edit mode, prevent editing completed/closed bounties
  if (
    mode === 'edit' &&
    bounty &&
    (bounty.status === BountyStatus.COMPLETED ||
      bounty.status === BountyStatus.CLOSED)
  ) {
    const bountyHref = routes.project.bountyDetail({
      slug,
      bountyId: bountyId!,
      title: bounty.title,
    })
    return (
      <AppBackground>
        <div className="mx-auto max-w-7xl p-6">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 rounded-full bg-muted p-4">
              <PieChart01 className="size-8 text-muted-foreground" />
            </div>
            <h2 className="mb-2 text-lg font-semibold">
              This bounty can&apos;t be edited
            </h2>
            <p className="mb-6 max-w-md text-sm text-muted-foreground">
              {bounty.status === BountyStatus.COMPLETED
                ? 'This bounty has been completed and points have been awarded. It can no longer be modified.'
                : 'This bounty has been closed. Reopen it first if you need to make changes.'}
            </p>
            <AppButton asChild>
              <Link href={bountyHref}>View Bounty</Link>
            </AppButton>
          </div>
        </div>
      </AppBackground>
    )
  }

  const projectLabels: ProjectLabel[] = labels ?? []

  const toggleLabel = (labelId: string) => {
    setSelectedLabelIds((prev) =>
      prev.includes(labelId)
        ? prev.filter((id) => id !== labelId)
        : [...prev, labelId],
    )
  }

  const applyTemplate = (template: (typeof BOUNTY_TEMPLATES)[number]) => {
    setTitle(template.title)
    setDescription(template.description)
    setPoints(template.points)
    setEvidenceDescription(template.evidenceDescription)
    // Match template label names to project labels
    const matchingIds = projectLabels
      .filter((l) =>
        template.labelNames.some(
          (name) => name.toLowerCase() === l.name.toLowerCase(),
        ),
      )
      .map((l) => l.id)
    setSelectedLabelIds(matchingIds)
  }

  const handleCreateLabel = () => {
    if (!newLabelName.trim() || !project?.id) return
    createLabel.mutate({
      projectId: project.id,
      name: newLabelName.trim(),
      color: newLabelColor,
    })
  }

  const handleRandomizeColor = () => {
    setNewLabelColor(generateRandomLabelColor())
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid) return

    setIsLoading(true)
    try {
      // If backlog is enabled, send null for points
      const pointsValue = isBacklog ? null : points

      // maxClaims only applies to multi-claim modes
      const hasMaxClaimsSupport = supportsMaxClaims(claimMode)

      if (mode === 'create') {
        await createBounty.mutateAsync({
          projectId: project.id,
          title,
          description,
          points: pointsValue,
          labelIds: selectedLabelIds,
          claimMode,
          claimExpiryDays: claimExpiryDays || DEFAULT_CLAIM_EXPIRY_DAYS,
          maxClaims: hasMaxClaimsSupport ? maxClaims : undefined,
          evidenceDescription: evidenceDescription || undefined,
        })
      } else {
        await updateBounty.mutateAsync({
          id: bountyId!,
          title,
          description,
          points: pointsValue,
          labelIds: selectedLabelIds,
          // Don't pass status - let the backend handle status transitions
          claimMode,
          claimExpiryDays: claimExpiryDays || DEFAULT_CLAIM_EXPIRY_DAYS,
          maxClaims: hasMaxClaimsSupport ? maxClaims : undefined,
          evidenceDescription: evidenceDescription || null,
        })
      }
    } catch {
      // Error is handled by onError callback
    } finally {
      setIsLoading(false)
    }
  }

  // Labels are now optional, points only required if not backlog
  const isValid =
    title.trim() && description.trim() && (isBacklog || points > 0)

  // Pool calculations
  const poolCapacity = poolStats?.poolCapacity ?? 1000
  const availablePoints = poolStats?.availablePoints ?? 1000

  const pageTitle = mode === 'create' ? 'New' : 'Edit'
  const submitLabel = mode === 'create' ? 'Create Bounty' : 'Save Changes'

  return (
    <AppBackground>
      <div className="mx-auto max-w-7xl p-6">
        {/* Breadcrumb navigation */}
        <div className="mb-6 flex items-center gap-2 text-sm">
          <Link
            href={routes.project.detail({ slug })}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            {project.name}
          </Link>
          <span className="text-muted-foreground/50">/</span>
          <Link
            href={routes.project.detail({
              slug,
              tab: ProjectTab.BOUNTIES,
            })}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Bounties
          </Link>
          <span className="text-muted-foreground/50">/</span>
          {mode === 'edit' && bounty && (
            <>
              <Link
                href={routes.project.bountyDetail({
                  slug,
                  bountyId: bountyId!,
                  title: bounty.title,
                })}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                {project.projectKey}-{bounty.number}
              </Link>
              <span className="text-muted-foreground/50">/</span>
            </>
          )}
          <span className="text-foreground">{pageTitle}</span>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Main layout */}
          <div className="grid gap-6 lg:grid-cols-[1fr_auto_280px]">
            {/* Main content - left side */}
            <div className="space-y-6">
              {/* Templates - only show in create mode */}
              {mode === 'create' && (
                <div className="flex flex-wrap gap-1.5">
                  {BOUNTY_TEMPLATES.map((template, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => applyTemplate(template)}
                      className="cursor-pointer rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs font-medium transition-colors hover:border-primary/30 hover:bg-muted"
                    >
                      {template.label}
                      <span className="ml-1 text-muted-foreground">
                        {template.points}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Main input area - bordered container */}
              <div className="rounded-lg border border-border bg-accent">
                {/* Title input - inline style */}
                <div className="px-4 py-3">
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Bounty title"
                    required
                    disabled={isLoading}
                    className="w-full bg-transparent text-xl font-semibold placeholder:text-muted-foreground/50 focus:outline-none"
                  />
                </div>

                <Separator />

                {/* Description input - markdown editor */}
                <div className="px-4 py-3">
                  <MarkdownEditor
                    value={description}
                    onChange={setDescription}
                    placeholder="Add description..."
                    disabled={isLoading}
                    minHeight="120px"
                    contentClassName="text-sm"
                  />
                </div>

                <Separator />

                {/* Acceptance Criteria - markdown editor */}
                <div className="px-4 py-3">
                  <MarkdownEditor
                    value={evidenceDescription}
                    onChange={setEvidenceDescription}
                    placeholder="Acceptance criteria (optional)... What proof should contributors provide?"
                    disabled={isLoading}
                    minHeight="80px"
                    contentClassName="text-sm"
                  />
                </div>

                <Separator />

                {/* Labels at bottom of content area */}
                <div className="flex items-center gap-2 px-4 py-3">
                  <span className="text-xs text-muted-foreground">Labels</span>
                  <div className="flex flex-wrap gap-1.5">
                    {projectLabels.map((label) => {
                      const color = getLabelColor(label.color)
                      const isSelected = selectedLabelIds.includes(label.id)
                      return (
                        <button
                          key={label.id}
                          type="button"
                          onClick={() => toggleLabel(label.id)}
                          disabled={isLoading}
                          className="cursor-pointer"
                        >
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-xs transition-all',
                              !isSelected &&
                                'border-border bg-transparent text-muted-foreground hover:bg-muted',
                            )}
                            style={
                              isSelected
                                ? {
                                    borderColor: color.dot,
                                    boxShadow: `0 0 0 2px ${color.dot}40`,
                                  }
                                : undefined
                            }
                          >
                            <span
                              className="mr-1.5 size-2 rounded-full"
                              style={{ backgroundColor: color.dot }}
                            />
                            {label.name}
                          </Badge>
                        </button>
                      )
                    })}
                    {/* Create new label button */}
                    <Popover
                      open={showCreateLabel}
                      onOpenChange={(open) => {
                        setShowCreateLabel(open)
                        if (open) {
                          // Generate a new random color when opening
                          setNewLabelColor(generateRandomLabelColor())
                        }
                      }}
                    >
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="mt-1 inline-flex h-6 cursor-pointer items-center gap-1 rounded-full border border-dashed border-border px-2 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
                        >
                          <Plus className="size-3" />
                          New
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72" align="start">
                        <div className="space-y-4">
                          <div className="text-sm font-medium">
                            Create label
                          </div>

                          {/* Preview */}
                          <div className="flex items-center justify-center rounded-md bg-muted/50 p-4">
                            <Badge
                              variant="outline"
                              className="max-w-full truncate text-sm"
                            >
                              <span
                                className="mr-1.5 size-2 shrink-0 rounded-full"
                                style={{ backgroundColor: newLabelColor }}
                              />
                              <span className="truncate">
                                {newLabelName || 'Label preview'}
                              </span>
                            </Badge>
                          </div>

                          {/* Name input */}
                          <div className="space-y-1.5">
                            <label className="text-xs text-muted-foreground">
                              Name
                            </label>
                            <input
                              type="text"
                              value={newLabelName}
                              onChange={(e) => setNewLabelName(e.target.value)}
                              placeholder="Label name"
                              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:outline-none"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  handleCreateLabel()
                                }
                              }}
                            />
                          </div>

                          {/* Color input */}
                          <div className="space-y-1.5">
                            <label className="text-xs text-muted-foreground">
                              Color
                            </label>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={handleRandomizeColor}
                                className="flex size-9 cursor-pointer items-center justify-center rounded-md border border-border transition-colors hover:bg-muted"
                                title="Generate random color"
                                style={{
                                  backgroundColor: `${newLabelColor}30`,
                                }}
                              >
                                <RefreshCcw01
                                  className="size-4"
                                  style={{ color: newLabelColor }}
                                />
                              </button>
                              <div className="relative flex-1">
                                <span className="absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                                  #
                                </span>
                                <input
                                  type="text"
                                  value={newLabelColor.replace('#', '')}
                                  onChange={(e) => {
                                    const value = e.target.value.replace(
                                      /[^0-9A-Fa-f]/g,
                                      '',
                                    )
                                    if (value.length <= 6) {
                                      setNewLabelColor(`#${value}`)
                                    }
                                  }}
                                  className="w-full rounded-md border border-border bg-background py-1.5 pr-3 pl-7 font-mono text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:outline-none"
                                  placeholder="d73a4a"
                                  maxLength={6}
                                  style={{
                                    borderColor:
                                      newLabelColor.length === 7
                                        ? newLabelColor
                                        : undefined,
                                  }}
                                />
                              </div>
                            </div>
                          </div>

                          <AppButton
                            type="button"
                            size="sm"
                            onClick={handleCreateLabel}
                            disabled={
                              !newLabelName.trim() ||
                              newLabelColor.length !== 7 ||
                              createLabel.isPending
                            }
                            className="w-full"
                          >
                            {createLabel.isPending && (
                              <Loader2 className="mr-1.5 size-3 animate-spin" />
                            )}
                            Create label
                          </AppButton>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>
            </div>

            {/* Vertical separator */}
            <Separator orientation="vertical" className="hidden lg:block" />

            {/* Sidebar - right side */}
            <div className="space-y-4">
              {/* Submit button at top */}
              <AppButton
                type="submit"
                disabled={isLoading || !isValid}
                className="w-full"
                size="sm"
              >
                {isLoading && (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                )}
                {submitLabel}
              </AppButton>

              <Separator />

              {/* Properties */}
              <div className="space-y-4 pt-2">
                {/* Points section */}
                <div className="space-y-3">
                  {/* Label with inline input */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <PieChart01 className="size-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        Points
                      </span>
                    </div>
                    <AppInput
                      type="number"
                      min="1"
                      value={isBacklog ? '' : points || ''}
                      onChange={(e) => setPoints(parseInt(e.target.value) || 0)}
                      onBlur={() => {
                        if (points < 1) setPoints(1)
                      }}
                      disabled={isLoading || isBacklog}
                      placeholder={isBacklog ? 'TBD' : undefined}
                      className="h-7 w-24 text-center text-sm font-semibold"
                    />
                  </div>

                  {/* Slider */}
                  <Slider
                    value={[points]}
                    onValueChange={([value]) => setPoints(value)}
                    min={5}
                    max={Math.max(availablePoints, 200, points)}
                    step={5}
                    disabled={isLoading || isBacklog}
                    className={cn('py-1', isBacklog && 'opacity-50')}
                  />

                  {/* Quick selects */}
                  <div className="flex flex-wrap gap-1">
                    {[5, 10, 25, 50, 100].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setPoints(preset)}
                        disabled={isLoading || isBacklog}
                        className={cn(
                          'cursor-pointer rounded-md border px-2 py-0.5 text-xs font-medium transition-colors',
                          points === preset && !isBacklog
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border bg-muted/50 text-muted-foreground hover:bg-muted',
                          isBacklog && 'cursor-not-allowed opacity-50',
                        )}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>

                  {/* Profit share info */}
                  {!isBacklog && (
                    <div className="space-y-0.5 rounded-md bg-primary/5 px-3 py-2 text-right text-xs">
                      {project.rewardPool && (
                        <div className="text-muted-foreground/70">
                          Roughly $
                          {(
                            (10000 *
                              project.rewardPool.poolPercentage *
                              (points / poolCapacity)) /
                            100
                          ).toLocaleString(undefined, {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                          })}{' '}
                          per $10k profit for current profit share size
                        </div>
                      )}
                    </div>
                  )}

                  {/* Backlog toggle */}
                  {(() => {
                    // Can't put a claimed bounty into backlog (someone is working on it)
                    const canToggleBacklog =
                      mode === 'create' ||
                      (bounty && bounty.status !== BountyStatus.CLAIMED)

                    return (
                      <div className="space-y-2 rounded-md border border-border bg-muted/30 px-3 py-2.5">
                        <label
                          className={cn(
                            'flex items-center justify-between gap-3',
                            canToggleBacklog
                              ? 'cursor-pointer'
                              : 'cursor-not-allowed opacity-60',
                          )}
                        >
                          <div className="space-y-0.5">
                            <div className="text-xs font-medium">
                              Backlog (estimate later)
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {canToggleBacklog
                                ? 'Add to backlog without assigning points yet. Contributors can see it but not claim it.'
                                : 'Cannot remove points while someone is working on this bounty.'}
                            </div>
                          </div>
                          <Switch
                            checked={isBacklog}
                            onCheckedChange={setIsBacklog}
                            disabled={isLoading || !canToggleBacklog}
                          />
                        </label>
                      </div>
                    )
                  })()}
                </div>

                <Separator />

                {/* Claim settings */}
                <div className="space-y-3">
                  {/* Claim type */}
                  <div className="flex items-center justify-between">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="flex cursor-help items-center gap-1 text-xs text-muted-foreground">
                          <Users01 className="size-3" />
                          Claim Type
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        How contributors can claim and complete this bounty.
                      </TooltipContent>
                    </Tooltip>
                    <Select
                      value={claimMode}
                      onValueChange={(v: BountyClaimMode) => setClaimMode(v)}
                      disabled={isLoading}
                    >
                      <SelectTrigger className="h-7 w-32 rounded-md border-border text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {getAvailableClaimModes().map((mode) => (
                          <SelectItem key={mode} value={mode}>
                            {getClaimModeInfo(mode).label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Claim type info */}
                  <div className="rounded-md bg-primary/5 px-3 py-2 text-right text-xs text-muted-foreground/70">
                    {getClaimModeInfo(claimMode).description}
                  </div>

                  {/* Claim expiry */}
                  <div className="flex items-center justify-between">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="flex cursor-help items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="size-3" />
                          Deadline (days)
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        Days until uncompleted claims expire
                      </TooltipContent>
                    </Tooltip>
                    <div className="flex items-center gap-1">
                      <AppInput
                        min="1"
                        max="90"
                        value={claimExpiryDays}
                        onChange={(e) => {
                          const val = e.target.value
                          setClaimExpiryDays(val === '' ? '' : parseInt(val))
                        }}
                        onBlur={() => {
                          if (
                            claimExpiryDays === '' ||
                            isNaN(claimExpiryDays)
                          ) {
                            setClaimExpiryDays(DEFAULT_CLAIM_EXPIRY_DAYS)
                          }
                        }}
                        disabled={isLoading}
                        className="h-7 w-20 rounded-md text-center text-xs"
                      />
                    </div>
                  </div>

                  {/* Claim expiry info */}
                  <div className="rounded-md bg-primary/5 px-3 py-2 text-right text-xs text-muted-foreground/70">
                    Contributors have{' '}
                    {claimExpiryDays || DEFAULT_CLAIM_EXPIRY_DAYS} days to
                    submit their work after claiming.
                  </div>

                  {/* Max claims (for multi-claim modes) */}
                  {supportsMaxClaims(claimMode) && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        Max Claims
                      </span>
                      <AppInput
                        min="1"
                        value={maxClaims ?? ''}
                        onChange={(e) =>
                          setMaxClaims(
                            e.target.value
                              ? parseInt(e.target.value)
                              : undefined,
                          )
                        }
                        placeholder="∞"
                        disabled={isLoading}
                        className="h-7 w-20 rounded-md text-center text-xs"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </AppBackground>
  )
}
