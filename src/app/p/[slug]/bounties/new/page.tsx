'use client'

import { useSession } from '@/lib/auth/react'
import { trpc } from '@/lib/trpc/react'
import {
  AlertTriangle,
  Clock,
  PieChart01,
  Users01,
} from '@untitled-ui/icons-react'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { notFound, redirect } from 'next/navigation'
import {
  BountyClaimMode,
  BountyTag,
  DEFAULT_CLAIM_EXPIRY_DAYS,
} from '@/lib/db/types'
import { ProjectTab, routes } from '@/lib/routes'
import { cn } from '@/lib/utils'
import { AppButton, AppInput } from '@/components/app'
import { AppBackground } from '@/components/layout/app-background'
import { Badge } from '@/components/ui/badge'
import { MarkdownEditor } from '@/components/ui/markdown-editor'
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { toast } from 'sonner'

const TAG_OPTIONS: { value: BountyTag; label: string; color: string }[] = [
  {
    value: BountyTag.GROWTH,
    label: 'Growth',
    color: 'bg-green-500/10 text-green-500 border-green-500/20',
  },
  {
    value: BountyTag.SALES,
    label: 'Sales',
    color: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  },
  {
    value: BountyTag.CONTENT,
    label: 'Content',
    color: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  },
  {
    value: BountyTag.DESIGN,
    label: 'Design',
    color: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
  },
  {
    value: BountyTag.DEV,
    label: 'Dev',
    color: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  },
]

const BOUNTY_TEMPLATES = [
  {
    label: 'Customer referral',
    title: 'Bring in a new customer (90-day retention)',
    description:
      'Refer a new paying customer who stays active for at least 90 days. You will receive points once the customer completes their first 90 days.',
    points: 50,
    tags: [BountyTag.SALES, BountyTag.GROWTH],
    evidenceDescription:
      'Provide the customer name/company, signup date, and confirmation of their 90-day retention. Screenshots from billing/CRM are helpful.',
  },
  {
    label: 'Case study',
    title: 'Write a case study that converts',
    description:
      'Create a compelling case study featuring one of our customers. The case study should include the problem, solution, and measurable results.',
    points: 30,
    tags: [BountyTag.CONTENT],
    evidenceDescription:
      'Submit the published case study URL. Bonus points if you can attribute a lead/customer to the case study.',
  },
  {
    label: 'MRR milestone',
    title: 'Hit MRR milestone',
    description:
      'Help us reach our next MRR milestone. This is a team bounty - points will be awarded to all active contributors who helped achieve it.',
    points: 100,
    tags: [BountyTag.GROWTH],
    evidenceDescription:
      'MRR milestones are verified by the founder through internal dashboards.',
  },
  {
    label: 'Design',
    title: 'Design improvement',
    description:
      'Improve the design of a specific feature or page. Must be approved and implemented.',
    points: 15,
    tags: [BountyTag.DESIGN],
    evidenceDescription:
      'Submit your design files (Figma, screenshots) and wait for approval before implementation.',
  },
  {
    label: 'Bug fix',
    title: 'Bug fix or feature implementation',
    description:
      'Fix a reported bug or implement a small feature. Must follow our code standards and pass review.',
    points: 20,
    tags: [BountyTag.DEV],
    evidenceDescription: 'Submit a link to your merged pull request.',
  },
]

export default function NewBountyPage() {
  const router = useRouter()
  const params = useParams<{ slug: string }>()
  const { data: session, isPending: sessionLoading } = useSession()
  const [isLoading, setIsLoading] = useState(false)

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [points, setPoints] = useState(25)
  const [tags, setTags] = useState<BountyTag[]>([])
  const [claimMode, setClaimMode] = useState<BountyClaimMode>(
    BountyClaimMode.SINGLE,
  )
  const [claimExpiryDays, setClaimExpiryDays] = useState(
    DEFAULT_CLAIM_EXPIRY_DAYS,
  )
  const [maxClaims, setMaxClaims] = useState<number | undefined>(undefined)
  const [evidenceDescription, setEvidenceDescription] = useState('')

  // Fetch project data
  const { data: project, isLoading: projectLoading } =
    trpc.project.getBySlug.useQuery(
      { slug: params.slug },
      { enabled: !!params.slug },
    )

  // Fetch pool stats
  const { data: poolStats, isLoading: poolStatsLoading } =
    trpc.project.getPoolStats.useQuery(
      { projectId: project?.id ?? '' },
      { enabled: !!project?.id },
    )

  const utils = trpc.useUtils()

  const createBounty = trpc.bounty.create.useMutation({
    onSuccess: (bounty) => {
      toast.success('Bounty created!')
      utils.bounty.getByProject.invalidate({ projectId: project?.id })
      router.push(
        routes.project.bountyDetail({ slug: params.slug, bountyId: bounty.id }),
      )
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  // Loading states
  if (sessionLoading || projectLoading || poolStatsLoading) {
    return (
      <AppBackground>
        <div className="mx-auto max-w-7xl px-4 py-6">
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

  // Project not found
  if (!project) {
    notFound()
  }

  // Check if user is the founder
  if (project.founderId !== session.user.id) {
    notFound()
  }

  const toggleTag = (tag: BountyTag) => {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    )
  }

  const applyTemplate = (template: (typeof BOUNTY_TEMPLATES)[number]) => {
    setTitle(template.title)
    setDescription(template.description)
    setPoints(template.points)
    setTags(template.tags)
    setEvidenceDescription(template.evidenceDescription)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid) return

    setIsLoading(true)
    try {
      await createBounty.mutateAsync({
        projectId: project.id,
        title,
        description,
        points,
        tags,
        claimMode,
        claimExpiryDays,
        maxClaims:
          claimMode === BountyClaimMode.MULTIPLE ? maxClaims : undefined,
        evidenceDescription: evidenceDescription || undefined,
      })
    } finally {
      setIsLoading(false)
    }
  }

  const isValid =
    title.trim() && description.trim() && points > 0 && tags.length > 0

  // Pool calculations
  const poolCapacity = poolStats?.poolCapacity ?? 1000
  const allocatedPoints = poolStats?.allocatedPoints ?? 0
  const availablePoints = poolStats?.availablePoints ?? 1000
  const newTotalAllocated = allocatedPoints + points
  const wouldExceedCapacity = newTotalAllocated > poolCapacity
  const bountyPercent = (points / poolCapacity) * 100

  return (
    <AppBackground>
      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* Breadcrumb navigation */}
        <div className="mb-6 flex items-center gap-2 text-sm">
          <Link
            href={routes.project.detail({ slug: params.slug })}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            {project.name}
          </Link>
          <span className="text-muted-foreground/50">/</span>
          <Link
            href={routes.project.detail({
              slug: params.slug,
              tab: ProjectTab.BOUNTIES,
            })}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Bounties
          </Link>
          <span className="text-muted-foreground/50">/</span>
          <span className="text-foreground">New Bounty</span>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Main layout */}
          <div className="grid gap-6 lg:grid-cols-[1fr_auto_280px]">
            {/* Main content - left side */}
            <div className="space-y-6">
              {/* Templates - compact chips */}
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

              {/* Main input area - bordered container */}
              <div className="rounded-lg border border-border bg-card">
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
                    {TAG_OPTIONS.map((tag) => (
                      <button
                        key={tag.value}
                        type="button"
                        onClick={() => toggleTag(tag.value)}
                        disabled={isLoading}
                        className="cursor-pointer"
                      >
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-xs transition-colors',
                            tags.includes(tag.value)
                              ? tag.color
                              : 'border-border bg-transparent text-muted-foreground hover:bg-muted',
                          )}
                        >
                          {tag.label}
                        </Badge>
                      </button>
                    ))}
                  </div>
                  {tags.length === 0 && (
                    <span className="text-[10px] text-muted-foreground/50">
                      Select at least one
                    </span>
                  )}
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
                Create Bounty
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
                      value={points || ''}
                      onChange={(e) => setPoints(parseInt(e.target.value) || 0)}
                      onBlur={() => {
                        if (points < 1) setPoints(1)
                      }}
                      disabled={isLoading}
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
                    disabled={isLoading}
                    className="py-1"
                  />

                  {/* Quick selects */}
                  <div className="flex flex-wrap gap-1">
                    {[5, 10, 25, 50, 100].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setPoints(preset)}
                        disabled={isLoading}
                        className={cn(
                          'cursor-pointer rounded-md border px-2 py-0.5 text-xs font-medium transition-colors',
                          points === preset
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border bg-muted/50 text-muted-foreground hover:bg-muted',
                        )}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>

                  {/* Pool share info */}
                  <div className="space-y-1 rounded-md bg-primary/5 px-3 py-2 text-xs">
                    <div className="whitespace-nowrap text-muted-foreground">
                      Pays{' '}
                      <span className="font-semibold text-primary">
                        {bountyPercent.toFixed(1)}%
                      </span>{' '}
                      of pool per payout
                    </div>
                    {project.rewardPool && (
                      <div className="whitespace-nowrap text-muted-foreground/70">
                        e.g. $
                        {(
                          (10000 *
                            project.rewardPool.poolPercentage *
                            bountyPercent) /
                          10000
                        ).toLocaleString(undefined, {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        })}{' '}
                        on $10k profit
                      </div>
                    )}
                  </div>

                  {/* Capacity warning */}
                  {wouldExceedCapacity && (
                    <div className="flex items-start gap-2 rounded-md bg-amber-500/10 px-3 py-2">
                      <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
                      <span className="text-xs text-amber-600 dark:text-amber-400">
                        This expands pool capacity, diluting existing
                        contributors
                      </span>
                    </div>
                  )}
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
                        Single: one person at a time. Multiple: competitive.
                      </TooltipContent>
                    </Tooltip>
                    <Select
                      value={claimMode}
                      onValueChange={(v: BountyClaimMode) => setClaimMode(v)}
                      disabled={isLoading}
                    >
                      <SelectTrigger className="h-7 w-24 rounded-md border-border text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={BountyClaimMode.SINGLE}>
                          Single
                        </SelectItem>
                        <SelectItem value={BountyClaimMode.MULTIPLE}>
                          Multiple
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Claim expiry */}
                  <div className="flex items-center justify-between">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="flex cursor-help items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="size-3" />
                          Claim Expiry (days)
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
                        onChange={(e) =>
                          setClaimExpiryDays(
                            parseInt(e.target.value) ||
                              DEFAULT_CLAIM_EXPIRY_DAYS,
                          )
                        }
                        disabled={isLoading}
                        className="h-7 w-20 rounded-md text-center text-xs"
                      />
                    </div>
                  </div>

                  {/* Max claims (only for multiple) */}
                  {claimMode === BountyClaimMode.MULTIPLE && (
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
