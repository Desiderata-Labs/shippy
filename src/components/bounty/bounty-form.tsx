'use client'

import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import {
  BountyClaimMode,
  BountyTag,
  DEFAULT_CLAIM_EXPIRY_DAYS,
} from '@/lib/db/types'
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
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export interface BountyFormData {
  title: string
  description: string
  points: number
  tags: BountyTag[]
  claimMode: BountyClaimMode
  claimExpiryDays: number
  maxClaims?: number
  evidenceDescription: string
}

interface BountyFormProps {
  mode: 'create' | 'edit'
  initialData?: BountyFormData
  isLoading: boolean
  onSubmit: (data: BountyFormData) => void
  onCancel: () => void
}

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
    title: 'Bring in a new customer (90-day retention)',
    description:
      'Refer a new paying customer who stays active for at least 90 days. You will receive points once the customer completes their first 90 days.',
    points: 100,
    tags: [BountyTag.SALES, BountyTag.GROWTH],
    evidenceDescription:
      'Provide the customer name/company, signup date, and confirmation of their 90-day retention. Screenshots from billing/CRM are helpful.',
  },
  {
    title: 'Write a case study that converts',
    description:
      'Create a compelling case study featuring one of our customers. The case study should include the problem, solution, and measurable results.',
    points: 50,
    tags: [BountyTag.CONTENT],
    evidenceDescription:
      'Submit the published case study URL. Bonus points if you can attribute a lead/customer to the case study.',
  },
  {
    title: 'Hit MRR milestone',
    description:
      'Help us reach our next MRR milestone. This is a team bounty - points will be awarded to all active contributors who helped achieve it.',
    points: 500,
    tags: [BountyTag.GROWTH],
    evidenceDescription:
      'MRR milestones are verified by the founder through internal dashboards.',
  },
  {
    title: 'Design improvement',
    description:
      'Improve the design of a specific feature or page. Must be approved and implemented.',
    points: 25,
    tags: [BountyTag.DESIGN],
    evidenceDescription:
      'Submit your design files (Figma, screenshots) and wait for approval before implementation.',
  },
  {
    title: 'Bug fix or feature implementation',
    description:
      'Fix a reported bug or implement a small feature. Must follow our code standards and pass review.',
    points: 30,
    tags: [BountyTag.DEV],
    evidenceDescription: 'Submit a link to your merged pull request.',
  },
]

export function BountyForm({
  mode,
  initialData,
  isLoading,
  onSubmit,
  onCancel,
}: BountyFormProps) {
  const [title, setTitle] = useState(initialData?.title ?? '')
  const [description, setDescription] = useState(initialData?.description ?? '')
  const [points, setPoints] = useState(initialData?.points ?? 100)
  const [tags, setTags] = useState<BountyTag[]>(initialData?.tags ?? [])
  const [claimMode, setClaimMode] = useState<BountyClaimMode>(
    initialData?.claimMode ?? BountyClaimMode.SINGLE,
  )
  const [claimExpiryDays, setClaimExpiryDays] = useState(
    initialData?.claimExpiryDays ?? DEFAULT_CLAIM_EXPIRY_DAYS,
  )
  const [maxClaims, setMaxClaims] = useState<number | undefined>(
    initialData?.maxClaims,
  )
  const [evidenceDescription, setEvidenceDescription] = useState(
    initialData?.evidenceDescription ?? '',
  )

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      title,
      description,
      points,
      tags,
      claimMode,
      claimExpiryDays,
      maxClaims: claimMode === BountyClaimMode.MULTIPLE ? maxClaims : undefined,
      evidenceDescription,
    })
  }

  const isValid =
    title.trim() && description.trim() && points > 0 && tags.length > 0

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Templates */}
      {mode === 'create' && (
        <AppCard>
          <AppCardHeader>
            <AppCardTitle>Quick Start Templates</AppCardTitle>
            <AppCardDescription>
              Start with a template or create from scratch
            </AppCardDescription>
          </AppCardHeader>
          <AppCardContent>
            <div className="flex flex-wrap gap-2">
              {BOUNTY_TEMPLATES.map((template, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => applyTemplate(template)}
                  className="cursor-pointer rounded-lg border border-border bg-muted/50 px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                >
                  <span className="font-medium">{template.title}</span>
                  <span className="ml-2 text-muted-foreground">
                    +{template.points} pts
                  </span>
                </button>
              ))}
            </div>
          </AppCardContent>
        </AppCard>
      )}

      {/* Basic Info */}
      <AppCard>
        <AppCardHeader>
          <AppCardTitle>Bounty Details</AppCardTitle>
          <AppCardDescription>
            Describe the work and what success looks like
          </AppCardDescription>
        </AppCardHeader>
        <AppCardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <AppInput
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Bring in a new clinic (90-day retention)"
              required
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <AppTextarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what needs to be done, how success is measured, and any requirements..."
              rows={5}
              required
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="points">Point Reward *</Label>
            <div className="flex items-center gap-2">
              <AppInput
                id="points"
                type="number"
                min="1"
                value={points}
                onChange={(e) => setPoints(parseInt(e.target.value) || 0)}
                required
                disabled={isLoading}
                className="w-32"
              />
              <span className="text-sm text-muted-foreground">points</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Higher points = larger share of the reward pool when payouts
              happen
            </p>
          </div>

          <div className="space-y-2">
            <Label>Tags *</Label>
            <div className="flex flex-wrap gap-2">
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
                    className={`${
                      tags.includes(tag.value)
                        ? tag.color
                        : 'border-border bg-transparent text-muted-foreground hover:bg-muted'
                    } transition-colors`}
                  >
                    {tag.label}
                  </Badge>
                </button>
              ))}
            </div>
            {tags.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Select at least one tag
              </p>
            )}
          </div>
        </AppCardContent>
      </AppCard>

      {/* Evidence Requirements */}
      <AppCard>
        <AppCardHeader>
          <AppCardTitle>Evidence Requirements</AppCardTitle>
          <AppCardDescription>
            What proof should contributors provide?
          </AppCardDescription>
        </AppCardHeader>
        <AppCardContent>
          <div className="space-y-2">
            <Label htmlFor="evidenceDescription">Required Evidence</Label>
            <AppTextarea
              id="evidenceDescription"
              value={evidenceDescription}
              onChange={(e) => setEvidenceDescription(e.target.value)}
              placeholder="e.g., Screenshots, links, documents, or other proof that the work was completed successfully..."
              rows={3}
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Clear evidence requirements help contributors know exactly what to
              submit
            </p>
          </div>
        </AppCardContent>
      </AppCard>

      {/* Claim Settings */}
      <AppCard>
        <AppCardHeader>
          <AppCardTitle>Claim Settings</AppCardTitle>
          <AppCardDescription>
            How contributors can work on this bounty
          </AppCardDescription>
        </AppCardHeader>
        <AppCardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="claimMode">Claim Mode</Label>
            <Select
              value={claimMode}
              onValueChange={(v: BountyClaimMode) => setClaimMode(v)}
              disabled={isLoading}
            >
              <SelectTrigger
                id="claimMode"
                className="rounded-xl border-border"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={BountyClaimMode.SINGLE}>
                  Single Claim
                </SelectItem>
                <SelectItem value={BountyClaimMode.MULTIPLE}>
                  Multiple Claims
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {claimMode === BountyClaimMode.SINGLE
                ? 'Only one contributor can work on this at a time'
                : 'Multiple contributors can work on this competitively'}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="claimExpiryDays">Claim Expiry (days)</Label>
            <AppInput
              id="claimExpiryDays"
              type="number"
              min="1"
              max="90"
              value={claimExpiryDays}
              onChange={(e) =>
                setClaimExpiryDays(
                  parseInt(e.target.value) || DEFAULT_CLAIM_EXPIRY_DAYS,
                )
              }
              disabled={isLoading}
              className="w-32"
            />
            <p className="text-xs text-muted-foreground">
              Claims expire after this many days if no work is submitted
            </p>
          </div>

          {claimMode === BountyClaimMode.MULTIPLE && (
            <div className="space-y-2">
              <Label htmlFor="maxClaims">Max Claims (optional)</Label>
              <AppInput
                id="maxClaims"
                type="number"
                min="1"
                value={maxClaims ?? ''}
                onChange={(e) =>
                  setMaxClaims(
                    e.target.value ? parseInt(e.target.value) : undefined,
                  )
                }
                placeholder="Unlimited"
                disabled={isLoading}
                className="w-32"
              />
              <p className="text-xs text-muted-foreground">
                Leave empty for unlimited claims
              </p>
            </div>
          )}
        </AppCardContent>
      </AppCard>

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
        <AppButton type="submit" disabled={isLoading || !isValid}>
          {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
          {mode === 'create' ? 'Create Bounty' : 'Save Changes'}
        </AppButton>
      </div>
    </form>
  )
}
