'use client'

import { useSession } from '@/lib/auth/react'
import { trpc } from '@/lib/trpc/react'
import {
  Globe02,
  MessageTextSquare02,
  PieChart01,
  Scale01,
  Settings01,
} from '@untitled-ui/icons-react'
import { Check, Loader2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { redirect } from 'next/navigation'
import {
  CommitmentMonths,
  PayoutFrequency,
  PayoutVisibility,
  ProfitBasis,
} from '@/lib/db/types'
import {
  normalizeProjectKey,
  suggestProjectKeyFromName,
} from '@/lib/project-key/shared'
import { routes } from '@/lib/routes'
import { slugify } from '@/lib/slugify'
import { cn } from '@/lib/utils'
import { useDebounce } from '@/hooks/use-debounce'
import { AppButton, AppInput } from '@/components/app'
import {
  ContributorAgreementPreview,
  ContributorAgreementSettings,
  type ContributorAgreementSettingsValue,
} from '@/components/contributor-agreement'
import { AppBackground } from '@/components/layout/app-background'
import { ProjectLogoUpload } from '@/components/project/project-logo-upload'
import { ErrorState } from '@/components/ui/error-state'
import { MarkdownEditor } from '@/components/ui/markdown-editor'
import { NotFoundState } from '@/components/ui/not-found-state'
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
import { toast } from 'sonner'

type ProjectSettingsTab = 'general' | 'profit-share' | 'agreements'

interface ProjectEditorProps {
  mode: 'create' | 'edit'
  username?: string // Required for create mode (for breadcrumb)
  slug?: string // Required for edit mode
}

export function ProjectEditor({ mode, username, slug }: ProjectEditorProps) {
  const router = useRouter()
  const { data: session, isPending: sessionLoading } = useSession()
  const [isLoading, setIsLoading] = useState(false)
  const [initialized, setInitialized] = useState(mode === 'create')

  // Form state
  const [name, setName] = useState('')
  const [projectSlug, setProjectSlug] = useState('')
  const [projectKey, setProjectKey] = useState('')
  const [tagline, setTagline] = useState('')
  const [description, setDescription] = useState('')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [discordUrl, setDiscordUrl] = useState('')
  const [poolPercentage, setPoolPercentage] = useState(10)
  const [payoutFrequency, setPayoutFrequency] = useState<PayoutFrequency>(
    PayoutFrequency.MONTHLY,
  )
  const [commitmentMonths, setCommitmentMonths] = useState<CommitmentMonths>(
    CommitmentMonths.FIVE_YEARS,
  )
  const [payoutVisibility, setPayoutVisibility] = useState<PayoutVisibility>(
    PayoutVisibility.PRIVATE,
  )

  // Contributor agreement settings (enabled by default, required for all projects)
  const [contributorAgreement, setContributorAgreement] =
    useState<ContributorAgreementSettingsValue>({
      contributorTermsEnabled: true,
      projectOwnerLegalName: '',
      projectOwnerContactEmail: '',
      projectOwnerAuthorizedRepresentativeName: '',
      projectOwnerAuthorizedRepresentativeTitle: '',
      contributorTermsGoverningLaw: '',
      contributorTermsCustom: '',
    })

  // Tab state
  const [activeTab, setActiveTab] = useState<ProjectSettingsTab>('general')
  const [showAgreementPreview, setShowAgreementPreview] = useState(false)

  // Track if user has attempted to submit (to show validation errors)
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false)

  // Track if slug/key were manually edited
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(mode === 'edit')
  const [projectKeyManuallyEdited, setProjectKeyManuallyEdited] = useState(
    mode === 'edit',
  )

  // Fetch project data for edit mode
  const {
    data: project,
    isLoading: projectLoading,
    isError: projectError,
    error: projectErrorData,
    refetch: refetchProject,
  } = trpc.project.getBySlug.useQuery(
    { slug: slug! },
    { enabled: mode === 'edit' && !!slug, retry: false },
  )

  // Initialize form with project data in edit mode
  useEffect(() => {
    if (mode === 'edit' && project && !initialized) {
      setName(project.name)
      setProjectSlug(project.slug)
      setProjectKey(project.projectKey)
      setTagline(project.tagline ?? '')
      setDescription(project.description ?? '')
      setLogoUrl(project.logoUrl ?? null)
      setWebsiteUrl(project.websiteUrl ?? '')
      setDiscordUrl(project.discordUrl ?? '')
      if (project.rewardPool) {
        setPoolPercentage(project.rewardPool.poolPercentage)
        setPayoutFrequency(
          project.rewardPool.payoutFrequency as PayoutFrequency,
        )
        // Convert commitment months number to enum
        const months = project.rewardPool.commitmentMonths
        if (months === 6) setCommitmentMonths(CommitmentMonths.SIX_MONTHS)
        else if (months === 12) setCommitmentMonths(CommitmentMonths.ONE_YEAR)
        else if (months === 24) setCommitmentMonths(CommitmentMonths.TWO_YEARS)
        else if (months === 36)
          setCommitmentMonths(CommitmentMonths.THREE_YEARS)
        else if (months === 60) setCommitmentMonths(CommitmentMonths.FIVE_YEARS)
        else if (months === 120) setCommitmentMonths(CommitmentMonths.TEN_YEARS)
        else if (months === 9999) setCommitmentMonths(CommitmentMonths.FOREVER)
        else setCommitmentMonths(CommitmentMonths.FIVE_YEARS)
      }
      setPayoutVisibility(project.payoutVisibility as PayoutVisibility)
      // Contributor agreement settings
      setContributorAgreement({
        contributorTermsEnabled: project.contributorTermsEnabled,
        projectOwnerLegalName: project.projectOwnerLegalName ?? '',
        projectOwnerContactEmail: project.projectOwnerContactEmail ?? '',
        projectOwnerAuthorizedRepresentativeName:
          project.projectOwnerAuthorizedRepresentativeName ?? '',
        projectOwnerAuthorizedRepresentativeTitle:
          project.projectOwnerAuthorizedRepresentativeTitle ?? '',
        contributorTermsGoverningLaw:
          project.contributorTermsGoverningLaw ?? '',
        contributorTermsCustom: project.contributorTermsCustom ?? '',
      })
      setInitialized(true)
    }
  }, [mode, project, initialized])

  // Debounce for availability checks
  const debouncedSlug = useDebounce(projectSlug, 300)
  const debouncedProjectKey = useDebounce(projectKey, 300)

  // Check slug availability
  const shouldCheckSlug =
    debouncedSlug.length >= 2 &&
    (mode === 'create' || debouncedSlug !== project?.slug)

  const { data: slugAvailability, isLoading: isCheckingSlug } =
    trpc.project.checkSlugAvailable.useQuery(
      { slug: debouncedSlug },
      { enabled: shouldCheckSlug },
    )

  // Check project key availability
  const normalizedKeyForCheck = normalizeProjectKey(debouncedProjectKey)
  const shouldCheckProjectKey =
    normalizedKeyForCheck.length === 3 &&
    (mode === 'create' || normalizedKeyForCheck !== project?.projectKey)

  const { data: keyAvailability, isLoading: isCheckingKey } =
    trpc.project.checkProjectKeyAvailable.useQuery(
      {
        projectKey: normalizedKeyForCheck,
        excludeProjectId: mode === 'edit' ? project?.id : undefined,
      },
      { enabled: shouldCheckProjectKey },
    )

  const utils = trpc.useUtils()

  const createProject = trpc.project.create.useMutation({
    onSuccess: (newProject) => {
      toast.success('Project created!')
      router.push(routes.project.detail({ slug: newProject.slug }))
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const updateProject = trpc.project.update.useMutation({
    onSuccess: (updatedProject) => {
      toast.success('Project updated!')
      utils.project.getBySlug.invalidate({ slug: updatedProject.slug })
      router.push(routes.project.detail({ slug: updatedProject.slug }))
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  // Loading states
  const isDataLoading =
    sessionLoading ||
    (mode === 'edit' && projectLoading) ||
    (mode === 'edit' && !initialized)

  if (isDataLoading) {
    return (
      <AppBackground>
        <div className="mx-auto max-w-7xl p-6">
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

  // Auth check
  if (!session) {
    redirect(routes.auth.signIn())
  }

  const sessionUsername = (session.user as { username?: string }).username

  // For create mode, verify user is on their own profile
  if (mode === 'create') {
    if (!sessionUsername || sessionUsername !== username) {
      if (sessionUsername) {
        redirect(routes.user.newProject({ username: sessionUsername }))
      }
      redirect(routes.dashboard.root())
    }
  }

  // Handle project errors in edit mode
  if (mode === 'edit' && projectError) {
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

  // Project not found or user is not the founder (edit mode only)
  if (mode === 'edit' && (!project || project.founderId !== session.user.id)) {
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

  // Determine if slug is valid for submission
  const isSlugValid =
    projectSlug.length >= 2 &&
    (mode === 'edit' && projectSlug === project?.slug
      ? true
      : !isCheckingSlug && slugAvailability?.available)

  const isProjectKeyValid =
    normalizeProjectKey(projectKey).length === 3 &&
    (mode === 'edit' && normalizeProjectKey(projectKey) === project?.projectKey
      ? true
      : !isCheckingKey && keyAvailability?.available)

  // Agreement validation - if enabled, must have required fields
  const isAgreementValid =
    !contributorAgreement.contributorTermsEnabled ||
    (contributorAgreement.projectOwnerLegalName.trim() !== '' &&
      contributorAgreement.projectOwnerContactEmail.trim() !== '')

  const agreementValidationError =
    contributorAgreement.contributorTermsEnabled && !isAgreementValid
      ? 'Contributor Agreement requires Legal Entity Name and Contact Email'
      : null

  const isValid =
    name.trim() &&
    isSlugValid &&
    isProjectKeyValid &&
    poolPercentage > 0 &&
    isAgreementValid

  // Auto-generate slug from name
  const handleNameChange = (value: string) => {
    setName(value)
    if (!slugManuallyEdited) {
      setProjectSlug(slugify(value))
    }
    if (!projectKeyManuallyEdited) {
      setProjectKey(suggestProjectKeyFromName(value))
    }
  }

  // Handle manual slug changes
  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = slugify(e.target.value)
    setProjectSlug(value)
    setSlugManuallyEdited(true)
  }

  const handleProjectKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = normalizeProjectKey(e.target.value)
    setProjectKey(value)
    setProjectKeyManuallyEdited(true)
  }

  // Render status icons
  const renderSlugStatus = () => {
    if (projectSlug.length < 2) return null

    // In edit mode, if slug hasn't changed, show check
    if (mode === 'edit' && projectSlug === project?.slug) {
      return <Check className="size-4 text-primary" />
    }

    if (isCheckingSlug) {
      return <Loader2 className="size-4 animate-spin text-muted-foreground" />
    }
    if (slugAvailability?.available) {
      return <Check className="size-4 text-primary" />
    }
    return <X className="size-4 text-destructive" />
  }

  const renderProjectKeyStatus = () => {
    if (normalizeProjectKey(projectKey).length !== 3) return null

    if (
      mode === 'edit' &&
      normalizeProjectKey(projectKey) === project?.projectKey
    ) {
      return <Check className="size-4 text-primary" />
    }

    if (isCheckingKey) {
      return <Loader2 className="size-4 animate-spin text-muted-foreground" />
    }
    if (keyAvailability?.available) {
      return <Check className="size-4 text-primary" />
    }
    return <X className="size-4 text-destructive" />
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setHasAttemptedSubmit(true)
    if (!isValid) return

    setIsLoading(true)
    try {
      if (mode === 'create') {
        await createProject.mutateAsync({
          name,
          slug: projectSlug,
          projectKey: normalizeProjectKey(projectKey),
          tagline: tagline || undefined,
          description: description || undefined,
          logoUrl: logoUrl || undefined,
          websiteUrl: websiteUrl || undefined,
          discordUrl: discordUrl || undefined,
          poolPercentage,
          payoutFrequency,
          profitBasis: ProfitBasis.NET_PROFIT,
          commitmentMonths,
          payoutVisibility,
          // Contributor agreement settings
          contributorTermsEnabled: contributorAgreement.contributorTermsEnabled,
          contributorTermsCustom:
            contributorAgreement.contributorTermsCustom || undefined,
          projectOwnerLegalName:
            contributorAgreement.projectOwnerLegalName || undefined,
          projectOwnerContactEmail:
            contributorAgreement.projectOwnerContactEmail || undefined,
          projectOwnerAuthorizedRepresentativeName:
            contributorAgreement.projectOwnerAuthorizedRepresentativeName ||
            undefined,
          projectOwnerAuthorizedRepresentativeTitle:
            contributorAgreement.projectOwnerAuthorizedRepresentativeTitle ||
            undefined,
          contributorTermsGoverningLaw:
            contributorAgreement.contributorTermsGoverningLaw || undefined,
        })
      } else {
        await updateProject.mutateAsync({
          id: project!.id,
          name,
          // Only include slug if it changed
          ...(projectSlug !== project!.slug ? { slug: projectSlug } : {}),
          ...(normalizeProjectKey(projectKey) !== project!.projectKey
            ? { projectKey: normalizeProjectKey(projectKey) }
            : {}),
          tagline: tagline || undefined,
          description: description || undefined,
          // logoUrl is NOT included here - it's auto-saved via updateLogo mutation
          websiteUrl: websiteUrl || null,
          discordUrl: discordUrl || null,
          // Visibility is always editable
          payoutVisibility,
          // Only include reward pool updates if allowed
          ...(project!.canEditRewardPool
            ? {
                poolPercentage,
                payoutFrequency,
                commitmentMonths,
              }
            : {}),
          // Contributor agreement settings
          contributorTermsEnabled: contributorAgreement.contributorTermsEnabled,
          contributorTermsCustom:
            contributorAgreement.contributorTermsCustom || null,
          projectOwnerLegalName:
            contributorAgreement.projectOwnerLegalName || null,
          projectOwnerContactEmail:
            contributorAgreement.projectOwnerContactEmail || null,
          projectOwnerAuthorizedRepresentativeName:
            contributorAgreement.projectOwnerAuthorizedRepresentativeName ||
            null,
          projectOwnerAuthorizedRepresentativeTitle:
            contributorAgreement.projectOwnerAuthorizedRepresentativeTitle ||
            null,
          contributorTermsGoverningLaw:
            contributorAgreement.contributorTermsGoverningLaw || null,
        })
      }
    } catch {
      // Error is handled by onError callback
    } finally {
      setIsLoading(false)
    }
  }

  const commitmentLabel = {
    [CommitmentMonths.SIX_MONTHS]: '6 months',
    [CommitmentMonths.ONE_YEAR]: '1 year',
    [CommitmentMonths.TWO_YEARS]: '2 years',
    [CommitmentMonths.THREE_YEARS]: '3 years',
    [CommitmentMonths.FIVE_YEARS]: '5 years',
    [CommitmentMonths.TEN_YEARS]: '10 years',
    [CommitmentMonths.FOREVER]: 'Forever',
  }

  const canEditRewardPool = mode === 'create' || project?.canEditRewardPool
  const slugChanged = mode === 'edit' && projectSlug !== project?.slug

  return (
    <AppBackground>
      <div className="mx-auto max-w-7xl p-6">
        {/* Breadcrumb navigation */}
        <div className="mb-6 flex items-center gap-2 text-sm">
          {mode === 'create' && username ? (
            <>
              <Link
                href={routes.user.profile({ username })}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                {username}
              </Link>
              <span className="text-muted-foreground/50">/</span>
              <span className="text-foreground">New Project</span>
            </>
          ) : (
            <>
              <Link
                href={routes.project.detail({ slug: project!.slug })}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                {project!.name}
              </Link>
              <span className="text-muted-foreground/50">/</span>
              <span className="text-foreground">Settings</span>
            </>
          )}
        </div>

        {/* Header with tabs and action button */}
        <div className="mx-auto mb-6 flex max-w-3xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Settings Tabs */}
          <div className="border-b border-border sm:border-b-0">
            <nav className="scrollbar-hide -mb-px flex gap-0.5 overflow-x-auto sm:mb-0">
              {(
                [
                  { value: 'general', label: 'General', icon: Settings01 },
                  {
                    value: 'profit-share',
                    label: 'Profit Share',
                    icon: PieChart01,
                  },
                  { value: 'agreements', label: 'Agreements', icon: Scale01 },
                ] as const
              ).map((tab, index) => {
                const Icon = tab.icon
                const isActive = activeTab === tab.value
                const hasError =
                  tab.value === 'agreements' && agreementValidationError
                const stepNumber = index + 1
                return (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => setActiveTab(tab.value)}
                    className={cn(
                      'group relative flex shrink-0 cursor-pointer items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors sm:gap-2 sm:px-4',
                      isActive
                        ? 'text-foreground'
                        : 'text-muted-foreground hover:text-foreground',
                      hasError && !isActive && 'text-destructive',
                    )}
                  >
                    {mode === 'create' && (
                      <span
                        className={cn(
                          'flex size-5 items-center justify-center rounded-full text-xs',
                          isActive
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {stepNumber}
                      </span>
                    )}
                    {mode === 'edit' && <Icon className="size-4" />}
                    <span>{tab.label}</span>
                    {hasError && !isActive && (
                      <span className="size-1.5 rounded-full bg-destructive" />
                    )}
                    {isActive && (
                      <span className="absolute right-0 bottom-0 left-0 h-0.5 rounded-full bg-primary sm:hidden" />
                    )}
                  </button>
                )
              })}
            </nav>
          </div>

          {/* Action button */}
          <div className="flex items-center gap-3">
            {mode === 'create' ? (
              activeTab === 'agreements' ? (
                <AppButton
                  type="submit"
                  form="project-form"
                  disabled={isLoading || !isValid}
                  className="w-full sm:w-auto"
                >
                  {isLoading && (
                    <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  )}
                  Create Project
                </AppButton>
              ) : (
                <AppButton
                  type="button"
                  onClick={() => {
                    if (activeTab === 'general') {
                      setActiveTab('profit-share')
                    } else if (activeTab === 'profit-share') {
                      setActiveTab('agreements')
                      // Show validation errors when reaching the final step
                      setHasAttemptedSubmit(true)
                    }
                  }}
                  className="w-full sm:w-auto"
                >
                  Next Step →
                </AppButton>
              )
            ) : (
              <AppButton
                type="submit"
                form="project-form"
                disabled={isLoading || !isValid}
                className="w-full sm:w-auto"
              >
                {isLoading && (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                )}
                Save Changes
              </AppButton>
            )}
          </div>
        </div>

        {/* Validation errors (only shown after user attempts to submit) */}
        {hasAttemptedSubmit && agreementValidationError && (
          <div className="mx-auto my-4 max-w-3xl">
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {agreementValidationError}
            </div>
          </div>
        )}

        <form id="project-form" onSubmit={handleSubmit}>
          {/* General Tab */}
          {activeTab === 'general' && (
            <div className="mx-auto max-w-3xl space-y-6">
              {/* Main input area - bordered container */}
              <div className="rounded-lg border border-border bg-accent">
                {/* Logo upload */}
                <div className="p-4">
                  <ProjectLogoUpload
                    projectId={mode === 'edit' ? project?.id : undefined}
                    currentLogoUrl={logoUrl}
                    onLogoChange={setLogoUrl}
                    disabled={isLoading}
                  />
                </div>

                <Separator />

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
                      {process.env.NEXT_PUBLIC_APP_URL || 'https://shippy.sh'}
                      /p/
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={projectSlug}
                        onChange={handleSlugChange}
                        placeholder="project-slug"
                        disabled={isLoading}
                        className="max-w-30 min-w-24 bg-transparent text-sm placeholder:text-muted-foreground/50 focus:outline-none"
                      />
                      {renderSlugStatus()}
                    </div>
                  </div>
                  {slugAvailability?.error &&
                    projectSlug.length >= 2 &&
                    !isCheckingSlug &&
                    (mode === 'create' || slugChanged) && (
                      <p className="pl-8 text-xs text-destructive">
                        {slugAvailability.error}
                      </p>
                    )}
                  {/* Warning about changing slug */}
                  {slugChanged && (
                    <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
                      <p className="font-medium">
                        Warning: Changing your project URL
                      </p>
                      <p className="mt-1">
                        This will change your project&apos;s URL. Any existing
                        links to your project will stop working.
                      </p>
                    </div>
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
                        <span className="mr-5">→ </span>
                        {normalizeProjectKey(projectKey || 'ABC')}-1
                      </span>
                    </div>
                    <div className="shrink-0">{renderProjectKeyStatus()}</div>
                  </div>
                  {keyAvailability?.error &&
                    normalizeProjectKey(projectKey).length === 3 &&
                    !isCheckingKey &&
                    (mode === 'create' ||
                      normalizeProjectKey(projectKey) !==
                        project?.projectKey) && (
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
          )}

          {/* Profit Share Tab */}
          {activeTab === 'profit-share' && (
            <div className="mx-auto max-w-3xl space-y-6">
              {/* Reward Pool locked message - only in edit mode */}
              {mode === 'edit' && !canEditRewardPool && (
                <div className="rounded-lg border border-muted bg-muted/30 p-4 text-sm text-muted-foreground">
                  <p className="mb-3 font-medium text-foreground">
                    Profit Share (locked)
                  </p>
                  <p className="mb-3">
                    Profit share settings are locked because contributors have
                    already claimed or completed bounties on this project. This
                    protects contributors who committed based on your original
                    terms.
                  </p>
                  <div className="space-y-1">
                    <p>
                      <span className="font-medium text-foreground">
                        Profit share:
                      </span>{' '}
                      {project?.rewardPool?.poolPercentage}%
                    </p>
                    <p>
                      <span className="font-medium text-foreground">
                        Payout Frequency:
                      </span>{' '}
                      {project?.rewardPool?.payoutFrequency ===
                      PayoutFrequency.MONTHLY
                        ? 'Monthly'
                        : 'Quarterly'}
                    </p>
                    <p>
                      <span className="font-medium text-foreground">
                        Commitment Period:
                      </span>{' '}
                      {commitmentLabel[commitmentMonths]}
                    </p>
                  </div>
                </div>
              )}

              {canEditRewardPool && (
                <div className="space-y-6 rounded-lg border border-border bg-accent p-6">
                  <div>
                    <h3 className="text-sm font-medium">
                      Profit Share Percentage
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      What percentage of profits will be shared with
                      contributors
                    </p>
                    <div className="mt-4 space-y-3">
                      <div className="flex items-center gap-4">
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
                          className="h-10 w-24 text-center text-lg font-semibold"
                        />
                        <span className="text-lg text-muted-foreground">%</span>
                      </div>
                      <Slider
                        value={[poolPercentage]}
                        onValueChange={([value]) => setPoolPercentage(value)}
                        min={1}
                        max={50}
                        step={1}
                        disabled={isLoading}
                      />
                      <div className="flex flex-wrap gap-2">
                        {[5, 10, 15, 20, 25].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setPoolPercentage(preset)}
                            disabled={isLoading}
                            className={cn(
                              'cursor-pointer rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
                              poolPercentage === preset
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border bg-muted/50 text-muted-foreground hover:bg-muted',
                            )}
                          >
                            {preset}%
                          </button>
                        ))}
                      </div>
                      <div className="rounded-md bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
                        Example: $
                        {((10000 * poolPercentage) / 100).toLocaleString()} of
                        $10,000 profit → contributors
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid gap-6 sm:grid-cols-2">
                    <div>
                      <h3 className="text-sm font-medium">Payout Frequency</h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        How often you&apos;ll run payouts
                      </p>
                      <Select
                        value={payoutFrequency}
                        onValueChange={(v: PayoutFrequency) =>
                          setPayoutFrequency(v)
                        }
                        disabled={isLoading}
                      >
                        <SelectTrigger className="mt-3">
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

                    <div>
                      <h3 className="text-sm font-medium">Commitment Period</h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        How long you commit to paying contributors
                      </p>
                      <Select
                        value={commitmentMonths}
                        onValueChange={(v: CommitmentMonths) =>
                          setCommitmentMonths(v)
                        }
                        disabled={isLoading}
                      >
                        <SelectTrigger className="mt-3">
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
                          <SelectItem value={CommitmentMonths.FIVE_YEARS}>
                            5 years
                          </SelectItem>
                          <SelectItem value={CommitmentMonths.TEN_YEARS}>
                            10 years
                          </SelectItem>
                          <SelectItem value={CommitmentMonths.FOREVER}>
                            Forever
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium">Public Payouts</h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        When enabled, payout amounts are visible to everyone
                      </p>
                    </div>
                    <Switch
                      checked={payoutVisibility === PayoutVisibility.PUBLIC}
                      onCheckedChange={(checked) =>
                        setPayoutVisibility(
                          checked
                            ? PayoutVisibility.PUBLIC
                            : PayoutVisibility.PRIVATE,
                        )
                      }
                      disabled={isLoading}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Agreements Tab */}
          {activeTab === 'agreements' && (
            <div className="mx-auto max-w-3xl space-y-6">
              {/* Preview toggle - GitHub style */}
              <div className="flex items-center justify-end">
                <div className="inline-flex rounded-md border border-border">
                  <button
                    type="button"
                    onClick={() => setShowAgreementPreview(false)}
                    className={cn(
                      'cursor-pointer rounded-l-md px-3 py-1.5 text-xs font-medium transition-colors',
                      !showAgreementPreview
                        ? 'bg-accent text-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAgreementPreview(true)}
                    className={cn(
                      'cursor-pointer rounded-r-md border-l border-border px-3 py-1.5 text-xs font-medium transition-colors',
                      showAgreementPreview
                        ? 'bg-accent text-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    Preview
                  </button>
                </div>
              </div>

              {!showAgreementPreview ? (
                <ContributorAgreementSettings
                  value={contributorAgreement}
                  onChange={setContributorAgreement}
                  disabled={isLoading}
                  currentVersion={project?.contributorTermsVersion ?? 1}
                  showVersionWarning={
                    mode === 'edit' &&
                    contributorAgreement.contributorTermsCustom !==
                      (project?.contributorTermsCustom ?? '')
                  }
                  hideToggle
                />
              ) : (
                <ContributorAgreementPreview
                  projectName={name || 'Your Project'}
                  projectSlug={projectSlug || undefined}
                  contributorAgreement={contributorAgreement}
                  rewardPoolCommitmentEndsAt={
                    project?.rewardPool?.commitmentEndsAt
                  }
                />
              )}
            </div>
          )}
        </form>
      </div>
    </AppBackground>
  )
}
