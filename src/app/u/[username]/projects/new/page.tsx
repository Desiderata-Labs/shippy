'use client'

import { useSession } from '@/lib/auth/react'
import { trpc } from '@/lib/trpc/react'
import {
  Calendar,
  Clock,
  Globe02,
  MessageTextSquare02,
  PieChart01,
} from '@untitled-ui/icons-react'
import { Check, Loader2, X } from 'lucide-react'
import { useState } from 'react'
import Link from 'next/link'
import { redirect, useParams, useRouter } from 'next/navigation'
import { CommitmentMonths, PayoutFrequency, ProfitBasis } from '@/lib/db/types'
import {
  normalizeProjectKey,
  suggestProjectKeyFromName,
} from '@/lib/project-key/shared'
import { routes } from '@/lib/routes'
import { slugify } from '@/lib/slugify'
import { cn } from '@/lib/utils'
import { useDebounce } from '@/hooks/use-debounce'
import { AppButton, AppInput } from '@/components/app'
import { AppBackground } from '@/components/layout/app-background'
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

export default function NewProjectPage() {
  const router = useRouter()
  const params = useParams<{ username: string }>()
  const { data: session, isPending: sessionLoading } = useSession()
  const [isLoading, setIsLoading] = useState(false)

  // Form state
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [projectKey, setProjectKey] = useState('')
  const [tagline, setTagline] = useState('')
  const [description, setDescription] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [discordUrl, setDiscordUrl] = useState('')
  const [poolPercentage, setPoolPercentage] = useState(10)
  const [payoutFrequency, setPayoutFrequency] = useState<PayoutFrequency>(
    PayoutFrequency.MONTHLY,
  )
  const [commitmentMonths, setCommitmentMonths] = useState<CommitmentMonths>(
    CommitmentMonths.ONE_YEAR,
  )

  // Track if slug/key were manually edited
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)
  const [projectKeyManuallyEdited, setProjectKeyManuallyEdited] =
    useState(false)

  // Debounce for availability checks
  const debouncedSlug = useDebounce(slug, 300)
  const debouncedProjectKey = useDebounce(projectKey, 300)

  // Check slug availability
  const shouldCheckSlug = debouncedSlug.length >= 2
  const { data: slugAvailability, isLoading: isCheckingSlug } =
    trpc.project.checkSlugAvailable.useQuery(
      { slug: debouncedSlug },
      { enabled: shouldCheckSlug },
    )

  // Check project key availability
  const normalizedKeyForCheck = normalizeProjectKey(debouncedProjectKey)
  const shouldCheckProjectKey = normalizedKeyForCheck.length === 3
  const { data: keyAvailability, isLoading: isCheckingKey } =
    trpc.project.checkProjectKeyAvailable.useQuery(
      { projectKey: normalizedKeyForCheck },
      { enabled: shouldCheckProjectKey },
    )

  const createProject = trpc.project.create.useMutation({
    onSuccess: (project) => {
      toast.success('Project created!')
      router.push(routes.project.detail({ slug: project.slug }))
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  // Check if viewing own profile
  const username = (session?.user as { username?: string })?.username
  const isOwnProfile = username === params.username

  // Loading state
  if (sessionLoading) {
    return (
      <AppBackground>
        <div className="mx-auto max-w-7xl px-4 py-6">
          <div className="mb-6">
            <Skeleton className="h-5 w-48" />
          </div>
          <div className="grid gap-6 lg:grid-cols-[1fr_auto_280px]">
            <Skeleton className="h-96" />
            <Skeleton className="hidden h-full w-px lg:block" />
            <Skeleton className="h-80" />
          </div>
        </div>
      </AppBackground>
    )
  }

  if (!session) {
    redirect(routes.auth.signIn())
  }

  // Only allow creating projects on own profile
  if (!isOwnProfile) {
    if (username) {
      redirect(routes.user.newProject({ username }))
    }
    redirect(routes.dashboard.root())
  }

  // Auto-generate slug from name
  const handleNameChange = (value: string) => {
    setName(value)
    if (!slugManuallyEdited) {
      setSlug(slugify(value))
    }
    if (!projectKeyManuallyEdited) {
      setProjectKey(suggestProjectKeyFromName(value))
    }
  }

  // Handle manual slug changes
  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = slugify(e.target.value)
    setSlug(value)
    setSlugManuallyEdited(true)
  }

  const handleProjectKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = normalizeProjectKey(e.target.value)
    setProjectKey(value)
    setProjectKeyManuallyEdited(true)
  }

  // Validation
  const isSlugValid =
    slug.length >= 2 && !isCheckingSlug && slugAvailability?.available
  const isProjectKeyValid =
    normalizeProjectKey(projectKey).length === 3 &&
    !isCheckingKey &&
    keyAvailability?.available
  const isValid =
    name.trim() && isSlugValid && isProjectKeyValid && poolPercentage > 0

  // Render status icons
  const renderSlugStatus = () => {
    if (slug.length < 2) return null
    if (isCheckingSlug) {
      return <Loader2 className="size-4 animate-spin text-muted-foreground" />
    }
    if (slugAvailability?.available) {
      return <Check className="size-4 text-green-500" />
    }
    return <X className="size-4 text-destructive" />
  }

  const renderProjectKeyStatus = () => {
    if (normalizeProjectKey(projectKey).length !== 3) return null
    if (isCheckingKey) {
      return <Loader2 className="size-4 animate-spin text-muted-foreground" />
    }
    if (keyAvailability?.available) {
      return <Check className="size-4 text-green-500" />
    }
    return <X className="size-4 text-destructive" />
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid) return

    setIsLoading(true)
    try {
      await createProject.mutateAsync({
        name,
        slug,
        projectKey: normalizeProjectKey(projectKey),
        tagline: tagline || undefined,
        description: description || undefined,
        websiteUrl: websiteUrl || undefined,
        discordUrl: discordUrl || undefined,
        poolPercentage,
        payoutFrequency,
        profitBasis: ProfitBasis.NET_PROFIT,
        commitmentMonths,
      })
    } finally {
      setIsLoading(false)
    }
  }

  const commitmentLabel = {
    [CommitmentMonths.SIX_MONTHS]: '6 months',
    [CommitmentMonths.ONE_YEAR]: '1 year',
    [CommitmentMonths.TWO_YEARS]: '2 years',
    [CommitmentMonths.THREE_YEARS]: '3 years',
  }

  return (
    <AppBackground>
      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* Breadcrumb navigation */}
        <div className="mb-6 flex items-center gap-2 text-sm">
          <Link
            href={routes.user.profile({ username: params.username })}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            {params.username}
          </Link>
          <span className="text-muted-foreground/50">/</span>
          <span className="text-foreground">New Project</span>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Main layout */}
          <div className="grid gap-6 lg:grid-cols-[1fr_auto_280px]">
            {/* Main content - left side */}
            <div className="space-y-6">
              {/* Main input area - bordered container */}
              <div className="rounded-lg border border-border bg-card">
                {/* Project name input */}
                <div className="px-4 py-3">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="Project name"
                    required
                    disabled={isLoading}
                    className="w-full bg-transparent text-xl font-semibold placeholder:text-muted-foreground/50 focus:outline-none"
                  />
                </div>

                <Separator />

                {/* Project identifiers */}
                <div className="space-y-3 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="shrink-0 text-sm text-muted-foreground">
                      https://shippy.sh/p/
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={slug}
                        onChange={handleSlugChange}
                        placeholder="project-slug"
                        disabled={isLoading}
                        className="max-w-30 min-w-24 bg-transparent text-sm placeholder:text-muted-foreground/50 focus:outline-none"
                      />
                      {renderSlugStatus()}
                    </div>
                  </div>
                  {slugAvailability?.error &&
                    slug.length >= 2 &&
                    !isCheckingSlug && (
                      <p className="pl-8 text-xs text-destructive">
                        {slugAvailability.error}
                      </p>
                    )}
                  <div className="flex items-center gap-3">
                    <span className="shrink-0 text-sm text-muted-foreground">
                      Bounty identifier prefix
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={projectKey}
                        onChange={handleProjectKeyChange}
                        placeholder="ABC"
                        disabled={isLoading}
                        className="w-16 bg-transparent text-center font-mono text-sm tracking-widest uppercase placeholder:text-muted-foreground/50 focus:outline-none"
                      />
                      <span className="text-sm text-muted-foreground">
                        → {normalizeProjectKey(projectKey || 'ABC')}-1
                      </span>
                    </div>
                    <div className="shrink-0">{renderProjectKeyStatus()}</div>
                  </div>
                  {keyAvailability?.error &&
                    normalizeProjectKey(projectKey).length === 3 &&
                    !isCheckingKey && (
                      <p className="pl-8 text-xs text-destructive">
                        {keyAvailability.error}
                      </p>
                    )}
                </div>

                <Separator />

                {/* Tagline input */}
                <div className="px-4 py-3">
                  <input
                    type="text"
                    value={tagline}
                    onChange={(e) => setTagline(e.target.value)}
                    placeholder="A short tagline describing your project..."
                    maxLength={200}
                    disabled={isLoading}
                    className="w-full bg-transparent text-sm placeholder:text-muted-foreground/50 focus:outline-none"
                  />
                </div>

                <Separator />

                {/* Description with markdown editor */}
                <div className="px-4 py-3">
                  <MarkdownEditor
                    value={description}
                    onChange={setDescription}
                    placeholder="Tell potential contributors about your project, mission, and how they can help..."
                    disabled={isLoading}
                    minHeight="120px"
                    contentClassName="text-sm"
                  />
                </div>

                <Separator />

                {/* URLs section */}
                <div className="space-y-3 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Globe02 className="size-4 shrink-0 text-muted-foreground" />
                    <input
                      type="url"
                      value={websiteUrl}
                      onChange={(e) => setWebsiteUrl(e.target.value)}
                      placeholder="https://your-website.com"
                      disabled={isLoading}
                      className="w-full bg-transparent text-sm placeholder:text-muted-foreground/50 focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <MessageTextSquare02 className="size-4 shrink-0 text-muted-foreground" />
                    <input
                      type="url"
                      value={discordUrl}
                      onChange={(e) => setDiscordUrl(e.target.value)}
                      placeholder="https://discord.gg/your-server"
                      disabled={isLoading}
                      className="w-full bg-transparent text-sm placeholder:text-muted-foreground/50 focus:outline-none"
                    />
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
                Create Project
              </AppButton>

              <Separator />

              {/* Reward Pool Settings */}
              <div className="space-y-4 pt-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Reward Pool
                </span>

                {/* Pool Percentage */}
                <div className="space-y-3 pt-2">
                  {/* Label with inline input */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <PieChart01 className="size-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        Pool Percentage
                      </span>
                    </div>
                    <div className="flex items-center">
                      <AppInput
                        type="number"
                        min="1"
                        max="100"
                        value={poolPercentage || ''}
                        onChange={(e) =>
                          setPoolPercentage(parseInt(e.target.value) || 0)
                        }
                        onBlur={() => {
                          if (poolPercentage < 1) setPoolPercentage(1)
                          if (poolPercentage > 100) setPoolPercentage(100)
                        }}
                        disabled={isLoading}
                        className="h-7 w-20 text-center text-sm font-semibold"
                      />
                      <span className="ml-1 text-sm text-muted-foreground">
                        %
                      </span>
                    </div>
                  </div>

                  {/* Slider */}
                  <Slider
                    value={[poolPercentage]}
                    onValueChange={([value]) => setPoolPercentage(value)}
                    min={1}
                    max={50}
                    step={1}
                    disabled={isLoading}
                    className="py-1"
                  />

                  {/* Quick selects */}
                  <div className="flex flex-wrap gap-1">
                    {[5, 10, 15, 20].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setPoolPercentage(preset)}
                        disabled={isLoading}
                        className={cn(
                          'cursor-pointer rounded-md border px-2 py-0.5 text-xs font-medium transition-colors',
                          poolPercentage === preset
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border bg-muted/50 text-muted-foreground hover:bg-muted',
                        )}
                      >
                        {preset}%
                      </button>
                    ))}
                  </div>

                  {/* Example info */}
                  <div className="rounded-md bg-primary/5 px-3 py-2 text-xs">
                    <span className="whitespace-nowrap text-muted-foreground">
                      e.g. ${((10000 * poolPercentage) / 100).toLocaleString()}{' '}
                      of $10,000 profit → contributors
                    </span>
                  </div>
                </div>

                <Separator />

                {/* Payout Frequency */}
                <div className="flex items-center justify-between">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex cursor-help items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="size-3" />
                        Payout Frequency
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs text-wrap">
                      How often you&apos;ll run payouts to contributors
                    </TooltipContent>
                  </Tooltip>
                  <Select
                    value={payoutFrequency}
                    onValueChange={(v: PayoutFrequency) =>
                      setPayoutFrequency(v)
                    }
                    disabled={isLoading}
                  >
                    <SelectTrigger className="h-7 w-24 rounded-md border-border text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={PayoutFrequency.MONTHLY}>
                        Monthly
                      </SelectItem>
                      <SelectItem value={PayoutFrequency.QUARTERLY}>
                        Quarterly
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Commitment Period */}
                <div className="flex items-center justify-between">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex cursor-help items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="size-3" />
                        Commitment
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs text-wrap">
                      How long you commit to running the pool and paying
                      contributors
                    </TooltipContent>
                  </Tooltip>
                  <Select
                    value={commitmentMonths}
                    onValueChange={(v: CommitmentMonths) =>
                      setCommitmentMonths(v)
                    }
                    disabled={isLoading}
                  >
                    <SelectTrigger className="h-7 w-24 rounded-md border-border text-xs">
                      <SelectValue>
                        {commitmentLabel[commitmentMonths]}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={CommitmentMonths.SIX_MONTHS}>
                        6 months
                      </SelectItem>
                      <SelectItem value={CommitmentMonths.ONE_YEAR}>
                        1 year
                      </SelectItem>
                      <SelectItem value={CommitmentMonths.TWO_YEARS}>
                        2 years
                      </SelectItem>
                      <SelectItem value={CommitmentMonths.THREE_YEARS}>
                        3 years
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </AppBackground>
  )
}
