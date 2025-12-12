'use client'

import { trpc } from '@/lib/trpc/react'
import { Check, Loader2, X } from 'lucide-react'
import { useState } from 'react'
import { CommitmentMonths, PayoutFrequency } from '@/lib/db/types'
import {
  normalizeProjectKey,
  suggestProjectKeyFromName,
} from '@/lib/project-key/shared'
import { slugify } from '@/lib/slugify'
import { useDebounce } from '@/hooks/use-debounce'
import {
  AppButton,
  AppCard,
  AppCardContent,
  AppCardDescription,
  AppCardHeader,
  AppCardTitle,
  AppInput,
  AppTextarea,
} from '@/components/app'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export interface ProjectFormData {
  name: string
  slug: string
  projectKey: string
  tagline: string
  description: string
  websiteUrl: string
  discordUrl: string
  poolPercentage: string
  payoutFrequency: PayoutFrequency
  commitmentMonths: CommitmentMonths
}

interface ProjectFormProps {
  mode: 'create' | 'edit'
  initialData?: ProjectFormData
  currentProjectId?: string
  currentSlug?: string // The existing slug when editing (to skip availability check for same slug)
  currentProjectKey?: string // The existing project key when editing (to skip availability check for same key)
  canEditRewardPool?: boolean // Whether reward pool can be edited (no claimed/completed bounties)
  isLoading: boolean
  onSubmit: (data: ProjectFormData) => void
  onCancel: () => void
}

export function ProjectForm({
  mode,
  initialData,
  currentProjectId,
  currentSlug,
  currentProjectKey,
  canEditRewardPool = false,
  isLoading,
  onSubmit,
  onCancel,
}: ProjectFormProps) {
  // Form state
  const [name, setName] = useState(initialData?.name ?? '')
  const [slug, setSlug] = useState(initialData?.slug ?? '')
  const [projectKey, setProjectKey] = useState(initialData?.projectKey ?? '')
  const [tagline, setTagline] = useState(initialData?.tagline ?? '')
  const [description, setDescription] = useState(initialData?.description ?? '')
  const [websiteUrl, setWebsiteUrl] = useState(initialData?.websiteUrl ?? '')
  const [discordUrl, setDiscordUrl] = useState(initialData?.discordUrl ?? '')
  const [poolPercentage, setPoolPercentage] = useState(
    initialData?.poolPercentage ?? '10',
  )
  const [payoutFrequency, setPayoutFrequency] = useState<PayoutFrequency>(
    initialData?.payoutFrequency ?? PayoutFrequency.MONTHLY,
  )
  const [commitmentMonths, setCommitmentMonths] = useState<CommitmentMonths>(
    initialData?.commitmentMonths ?? CommitmentMonths.ONE_YEAR,
  )

  // Track if slug was manually edited
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(mode === 'edit')
  const [projectKeyManuallyEdited, setProjectKeyManuallyEdited] = useState(
    mode === 'edit',
  )

  // Debounce slug for availability check
  const debouncedSlug = useDebounce(slug, 300)
  const debouncedProjectKey = useDebounce(projectKey, 300)

  // Check slug availability (only for create mode, or if slug changed in edit mode)
  const shouldCheckSlug =
    debouncedSlug.length >= 2 &&
    (mode === 'create' || debouncedSlug !== currentSlug)

  const { data: slugAvailability, isLoading: isCheckingSlug } =
    trpc.project.checkSlugAvailable.useQuery(
      { slug: debouncedSlug },
      { enabled: shouldCheckSlug },
    )

  // Check project key availability (only when key is valid length, and changed in edit mode)
  const normalizedKeyForCheck = normalizeProjectKey(debouncedProjectKey)
  const shouldCheckProjectKey =
    normalizedKeyForCheck.length === 3 &&
    (mode === 'create' || normalizedKeyForCheck !== currentProjectKey)

  const { data: keyAvailability, isLoading: isCheckingKey } =
    trpc.project.checkProjectKeyAvailable.useQuery(
      {
        projectKey: normalizedKeyForCheck,
        excludeProjectId: mode === 'edit' ? currentProjectId : undefined,
      },
      { enabled: shouldCheckProjectKey },
    )

  // Determine if slug is valid for submission
  const isSlugValid =
    slug.length >= 2 &&
    (mode === 'edit' && slug === currentSlug
      ? true
      : !isCheckingSlug && slugAvailability?.available)

  const isProjectKeyValid =
    normalizeProjectKey(projectKey).length === 3 &&
    (mode === 'edit' && normalizeProjectKey(projectKey) === currentProjectKey
      ? true
      : !isCheckingKey && keyAvailability?.available)

  // Render slug status icon
  const renderSlugStatus = () => {
    if (slug.length < 2) {
      return null
    }

    // In edit mode, if slug hasn't changed, show check
    if (mode === 'edit' && slug === currentSlug) {
      return <Check className="size-4 text-green-500" />
    }

    if (isCheckingSlug) {
      return <Loader2 className="size-4 animate-spin text-muted-foreground" />
    }

    if (slugAvailability?.available) {
      return <Check className="size-4 text-green-500" />
    }

    return <X className="size-4 text-destructive" />
  }

  const renderProjectKeyStatus = () => {
    if (normalizeProjectKey(projectKey).length !== 3) {
      return null
    }

    if (
      mode === 'edit' &&
      normalizeProjectKey(projectKey) === currentProjectKey
    ) {
      return <Check className="size-4 text-green-500" />
    }

    if (isCheckingKey) {
      return <Loader2 className="size-4 animate-spin text-muted-foreground" />
    }

    if (keyAvailability?.available) {
      return <Check className="size-4 text-green-500" />
    }

    return <X className="size-4 text-destructive" />
  }

  // Auto-generate slug from name (only in create mode and if not manually edited)
  const handleNameChange = (value: string) => {
    setName(value)
    if (mode === 'create' && !slugManuallyEdited) {
      setSlug(slugify(value))
    }
    if (mode === 'create' && !projectKeyManuallyEdited) {
      setProjectKey(suggestProjectKeyFromName(value))
    }
  }

  // Handle manual slug changes
  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Use slugify to ensure consistent formatting
    const value = slugify(e.target.value)
    setSlug(value)
    setSlugManuallyEdited(true)
  }

  const handleProjectKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = normalizeProjectKey(e.target.value)
    setProjectKey(value)
    setProjectKeyManuallyEdited(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      name,
      slug,
      projectKey: normalizeProjectKey(projectKey),
      tagline,
      description,
      websiteUrl,
      discordUrl,
      poolPercentage,
      payoutFrequency,
      commitmentMonths,
    })
  }

  const isEditMode = mode === 'edit'
  const slugChanged = isEditMode && slug !== currentSlug

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Info */}
      <AppCard>
        <AppCardHeader>
          <AppCardTitle>Project Details</AppCardTitle>
          <AppCardDescription>
            Basic information about your project
          </AppCardDescription>
        </AppCardHeader>
        <AppCardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Project Name *</Label>
            <AppInput
              id="name"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="My Awesome Startup"
              required
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="projectKey">Bounty ID Prefix *</Label>
            <div className="flex items-center gap-2">
              <div className="relative w-28">
                <AppInput
                  id="projectKey"
                  value={projectKey}
                  onChange={handleProjectKeyChange}
                  placeholder="OTH"
                  pattern="^[A-Za-z]{0,3}$"
                  required
                  disabled={isLoading}
                  className="pr-10 font-mono tracking-widest uppercase"
                />
                <div className="absolute top-1/2 right-3 -translate-y-1/2">
                  {renderProjectKeyStatus()}
                </div>
              </div>
              <span className="text-sm text-muted-foreground">
                Example: {normalizeProjectKey(projectKey || 'OTH')}-1
              </span>
            </div>
            {normalizeProjectKey(projectKey).length > 0 &&
              normalizeProjectKey(projectKey).length < 3 && (
                <p className="text-xs text-muted-foreground">
                  Prefix must be exactly 3 letters
                </p>
              )}
            {keyAvailability?.error &&
              normalizeProjectKey(projectKey).length === 3 &&
              !isCheckingKey &&
              (mode === 'create' ||
                normalizeProjectKey(projectKey) !== currentProjectKey) && (
                <p className="text-xs text-destructive">
                  {keyAvailability.error}
                </p>
              )}
            {keyAvailability?.available &&
              normalizeProjectKey(projectKey).length === 3 &&
              (mode === 'create' ||
                normalizeProjectKey(projectKey) !== currentProjectKey) && (
                <p className="text-xs text-green-600 dark:text-green-400">
                  Prefix is available!
                </p>
              )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">URL Slug *</Label>
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-sm text-muted-foreground">
                earnaslice.com/p/
              </span>
              <div className="relative flex-1">
                <AppInput
                  id="slug"
                  value={slug}
                  onChange={handleSlugChange}
                  placeholder="my-startup"
                  pattern="^[a-z0-9-]+$"
                  required
                  disabled={isLoading}
                  className="pr-10"
                />
                <div className="absolute top-1/2 right-3 -translate-y-1/2">
                  {renderSlugStatus()}
                </div>
              </div>
            </div>
            {slug.length > 0 && slug.length < 2 && (
              <p className="text-xs text-muted-foreground">
                Slug must be at least 2 characters
              </p>
            )}
            {slugAvailability?.error &&
              slug.length >= 2 &&
              !isCheckingSlug &&
              (mode === 'create' || slugChanged) && (
                <p className="text-xs text-destructive">
                  {slugAvailability.error}
                </p>
              )}
            {slugAvailability?.available &&
              slug.length >= 2 &&
              (mode === 'create' || slugChanged) && (
                <p className="text-xs text-green-600 dark:text-green-400">
                  Slug is available!
                </p>
              )}

            {/* Warning about changing slug */}
            {slugChanged && (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
                <p className="font-medium">
                  Warning: Changing your project URL
                </p>
                <p className="mt-1">
                  This will change your project&apos;s URL. Any existing links
                  to your project will stop working.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="tagline">Tagline</Label>
            <AppInput
              id="tagline"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="A short description of your project"
              maxLength={200}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <AppTextarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell potential contributors about your project, mission, and how they can help..."
              rows={5}
              disabled={isLoading}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="websiteUrl">Website URL</Label>
              <AppInput
                id="websiteUrl"
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://example.com"
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="discordUrl">Discord URL</Label>
              <AppInput
                id="discordUrl"
                type="url"
                value={discordUrl}
                onChange={(e) => setDiscordUrl(e.target.value)}
                placeholder="https://discord.gg/..."
                disabled={isLoading}
              />
            </div>
          </div>
        </AppCardContent>
      </AppCard>

      {/* Reward Pool */}
      {(mode === 'create' || canEditRewardPool) && (
        <AppCard>
          <AppCardHeader>
            <AppCardTitle>Reward Pool</AppCardTitle>
            <AppCardDescription>
              Configure how contributors will earn from your project
            </AppCardDescription>
          </AppCardHeader>
          <AppCardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="poolPercentage">Pool Percentage *</Label>
              <div className="flex items-center gap-2">
                <AppInput
                  id="poolPercentage"
                  type="number"
                  min="1"
                  max="100"
                  value={poolPercentage}
                  onChange={(e) => setPoolPercentage(e.target.value)}
                  required
                  disabled={isLoading}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">
                  % of net profit goes to contributors
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Example: If you set 10% and make $10,000 profit, $1,000 goes to
                the pool
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payoutFrequency">Payout Frequency *</Label>
              <Select
                value={payoutFrequency}
                onValueChange={(v: PayoutFrequency) => setPayoutFrequency(v)}
                disabled={isLoading}
              >
                <SelectTrigger
                  id="payoutFrequency"
                  className="rounded-xl border-border"
                >
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

            <div className="space-y-2">
              <Label htmlFor="commitmentMonths">Commitment Period *</Label>
              <Select
                value={commitmentMonths}
                onValueChange={(v: CommitmentMonths) => setCommitmentMonths(v)}
                disabled={isLoading}
              >
                <SelectTrigger
                  id="commitmentMonths"
                  className="rounded-xl border-border"
                >
                  <SelectValue />
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
              <p className="text-xs text-muted-foreground">
                How long you commit to running the reward pool and paying out
                contributors. Contributors see this before claiming bounties.
              </p>
            </div>
          </AppCardContent>
        </AppCard>
      )}

      {/* Reward Pool locked message */}
      {isEditMode && !canEditRewardPool && (
        <AppCard>
          <AppCardHeader>
            <AppCardTitle>Reward Pool</AppCardTitle>
            <AppCardDescription>
              Reward pool settings cannot be changed
            </AppCardDescription>
          </AppCardHeader>
          <AppCardContent>
            <div className="rounded-lg border border-muted bg-muted/30 p-4 text-sm text-muted-foreground">
              <p>
                Reward pool settings are locked because contributors have
                already claimed or completed bounties on this project. This
                protects contributors who committed based on your original
                terms.
              </p>
              <div className="mt-3 space-y-1">
                <p>
                  <span className="font-medium text-foreground">
                    Pool Percentage:
                  </span>{' '}
                  {poolPercentage}%
                </p>
                <p>
                  <span className="font-medium text-foreground">
                    Payout Frequency:
                  </span>{' '}
                  {payoutFrequency === PayoutFrequency.MONTHLY
                    ? 'Monthly'
                    : 'Quarterly'}
                </p>
                <p>
                  <span className="font-medium text-foreground">
                    Commitment Period:
                  </span>{' '}
                  {commitmentMonths === CommitmentMonths.SIX_MONTHS
                    ? '6 months'
                    : commitmentMonths === CommitmentMonths.ONE_YEAR
                      ? '1 year'
                      : commitmentMonths === CommitmentMonths.TWO_YEARS
                        ? '2 years'
                        : '3 years'}
                </p>
              </div>
            </div>
          </AppCardContent>
        </AppCard>
      )}

      {/* Submit */}
      <div className="flex justify-end gap-4">
        <AppButton
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancel
        </AppButton>
        <AppButton
          type="submit"
          disabled={isLoading || !isSlugValid || !isProjectKeyValid}
        >
          {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
          {mode === 'create' ? 'Create Project' : 'Save Changes'}
        </AppButton>
      </div>
    </form>
  )
}
