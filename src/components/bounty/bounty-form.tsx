'use client'

import { AlertTriangle, PieChart01 } from '@untitled-ui/icons-react'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { getLabelColor } from '@/lib/bounty/tag-colors'
import { BountyClaimMode, DEFAULT_CLAIM_EXPIRY_DAYS } from '@/lib/db/types'
import { cn } from '@/lib/utils'
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
import { Slider } from '@/components/ui/slider'

interface ProjectLabel {
  id: string
  name: string
  color: string
}

export interface BountyFormData {
  title: string
  description: string
  points: number
  labelIds: string[]
  claimMode: BountyClaimMode
  claimExpiryDays: number
  maxClaims?: number
  evidenceDescription: string
}

export interface PoolStats {
  poolCapacity: number
  allocatedPoints: number
  earnedPoints: number
  availablePoints: number
}

interface BountyFormProps {
  mode: 'create' | 'edit'
  initialData?: BountyFormData
  isLoading: boolean
  onSubmit: (data: BountyFormData) => void
  onCancel: () => void
  poolStats?: PoolStats
  projectLabels?: ProjectLabel[]
}

export function BountyForm({
  mode,
  initialData,
  isLoading,
  onSubmit,
  onCancel,
  poolStats,
  projectLabels = [],
}: BountyFormProps) {
  const [title, setTitle] = useState(initialData?.title ?? '')
  const [description, setDescription] = useState(initialData?.description ?? '')
  const [points, setPoints] = useState(initialData?.points ?? 100)
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>(
    initialData?.labelIds ?? [],
  )
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

  const toggleLabel = (labelId: string) => {
    setSelectedLabelIds((prev) =>
      prev.includes(labelId)
        ? prev.filter((id) => id !== labelId)
        : [...prev, labelId],
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      title,
      description,
      points,
      labelIds: selectedLabelIds,
      claimMode,
      claimExpiryDays,
      maxClaims: claimMode === BountyClaimMode.MULTIPLE ? maxClaims : undefined,
      evidenceDescription,
    })
  }

  // Labels are optional now
  const isValid = title.trim() && description.trim() && points > 0

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Pool Allocation & Points Input */}
      {poolStats && mode === 'create' && (
        <PoolAllocationCard
          poolStats={poolStats}
          bountyPoints={points}
          onPointsChange={setPoints}
          disabled={isLoading}
        />
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

          {/* Points input - only shown in edit mode or when poolStats unavailable */}
          {(!poolStats || mode === 'edit') && (
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
                Each point = 0.1% of the reward pool. A 50-point bounty pays 5%
                of the pool each payout.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Labels</Label>
            <div className="flex flex-wrap gap-2">
              {projectLabels.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No labels available for this project
                </p>
              ) : (
                projectLabels.map((label) => {
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
                          'transition-colors',
                          isSelected
                            ? `${color.border} ${color.text}`
                            : 'border-border bg-transparent text-muted-foreground hover:bg-muted',
                        )}
                      >
                        <span
                          className="mr-1.5 size-2 rounded-full"
                          style={{
                            backgroundColor: isSelected ? color.dot : undefined,
                          }}
                        />
                        {label.name}
                      </Badge>
                    </button>
                  )
                })
              )}
            </div>
            {selectedLabelIds.length === 0 && projectLabels.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Labels are optional
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

function PoolAllocationCard({
  poolStats,
  bountyPoints,
  onPointsChange,
  disabled,
}: {
  poolStats: PoolStats
  bountyPoints: number
  onPointsChange: (points: number) => void
  disabled?: boolean
}) {
  const { poolCapacity, allocatedPoints, availablePoints } = poolStats

  const newTotalAllocated = allocatedPoints + bountyPoints
  const wouldExceedCapacity = newTotalAllocated > poolCapacity
  const newCapacityIfExpanded = wouldExceedCapacity ? newTotalAllocated : null

  // Calculate percentages
  const bountyPercent = (bountyPoints / poolCapacity) * 100
  const allocatedPercent = (allocatedPoints / poolCapacity) * 100

  // Calculate dilution if expanding
  const dilutionPercent = newCapacityIfExpanded
    ? ((newCapacityIfExpanded - poolCapacity) / newCapacityIfExpanded) * 100
    : 0

  // Slider max is either available points or a reasonable amount beyond
  const sliderMax = Math.max(availablePoints, 500, bountyPoints)

  return (
    <AppCard>
      <AppCardHeader>
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
            <PieChart01 className="size-4 text-primary" />
          </div>
          <div>
            <AppCardTitle>Point Reward</AppCardTitle>
            <AppCardDescription>
              Each point = 0.1% of the reward pool
            </AppCardDescription>
          </div>
        </div>
      </AppCardHeader>
      <AppCardContent className="space-y-5">
        {/* Points input with slider */}
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Slider
                value={[bountyPoints]}
                onValueChange={([value]) => onPointsChange(value)}
                min={1}
                max={sliderMax}
                step={5}
                disabled={disabled}
                className="py-2"
              />
            </div>
            <div className="flex items-center gap-2">
              <AppInput
                type="number"
                min="1"
                value={bountyPoints}
                onChange={(e) => onPointsChange(parseInt(e.target.value) || 1)}
                disabled={disabled}
                className="w-24 text-center font-semibold"
              />
              <span className="text-sm text-muted-foreground">pts</span>
            </div>
          </div>

          {/* Quick select buttons */}
          <div className="flex flex-wrap gap-2">
            {[25, 50, 100, 200, 500].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => onPointsChange(preset)}
                disabled={disabled}
                className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                  bountyPoints === preset
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-muted/50 text-muted-foreground hover:bg-muted'
                }`}
              >
                {preset} pts
              </button>
            ))}
          </div>
        </div>

        {/* Visual progress bar */}
        <div className="space-y-2">
          <div className="flex h-3 overflow-hidden rounded-full bg-muted">
            {/* Already allocated */}
            <div
              className="bg-primary/50 transition-all duration-300"
              style={{ width: `${Math.min(allocatedPercent, 100)}%` }}
            />
            {/* This bounty */}
            <div
              className={`transition-all duration-300 ${wouldExceedCapacity ? 'bg-amber-500' : 'bg-primary'}`}
              style={{
                width: `${Math.min(bountyPercent, 100 - Math.min(allocatedPercent, 100))}%`,
              }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0 pts</span>
            <span>{poolCapacity.toLocaleString()} pts (capacity)</span>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg border border-border bg-muted/50 px-3 py-2">
            <div className="text-lg font-semibold">
              {allocatedPoints.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground">Allocated</div>
          </div>
          <div
            className={`rounded-lg border px-3 py-2 ${wouldExceedCapacity ? 'border-amber-500/30 bg-amber-500/10' : 'border-primary/30 bg-primary/10'}`}
          >
            <div
              className={`text-lg font-semibold ${wouldExceedCapacity ? 'text-amber-500' : 'text-primary'}`}
            >
              +{bountyPoints.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground">This bounty</div>
          </div>
          <div className="rounded-lg border border-border bg-muted/50 px-3 py-2">
            <div className="text-lg font-semibold">
              {Math.max(0, availablePoints - bountyPoints).toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground">Remaining</div>
          </div>
        </div>

        {/* This bounty's share */}
        <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              This bounty pays
            </span>
            <span className="font-semibold text-primary">
              {bountyPercent.toFixed(1)}% of pool per payout
            </span>
          </div>
        </div>

        {/* Capacity warning */}
        {wouldExceedCapacity && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-amber-500">
                  This will expand pool capacity
                </p>
                <p className="text-xs text-muted-foreground">
                  Capacity will increase from {poolCapacity.toLocaleString()} to{' '}
                  {newCapacityIfExpanded?.toLocaleString()} pts, diluting
                  existing contributors by {dilutionPercent.toFixed(1)}%.
                </p>
              </div>
            </div>
          </div>
        )}
      </AppCardContent>
    </AppCard>
  )
}
