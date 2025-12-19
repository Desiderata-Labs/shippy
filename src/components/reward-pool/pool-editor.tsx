'use client'

import { trpc } from '@/lib/trpc/react'
import { Calendar, Clock, PieChart01, Wallet02 } from '@untitled-ui/icons-react'
import { Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PoolStatus, PoolType } from '@/lib/db/types'
import { ProjectTab, routes } from '@/lib/routes'
import { cn } from '@/lib/utils'
import { AppButton, AppInput } from '@/components/app'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { toast } from 'sonner'

interface PoolEditorProps {
  mode: 'create' | 'edit'
  projectId: string
  projectSlug: string
  poolId?: string // Required for edit mode
}

const poolTypeConfig = {
  [PoolType.PROFIT_SHARE]: {
    label: 'Profit Share',
    description:
      'Share a percentage of your profit with contributors periodically',
    icon: PieChart01,
    color: 'border-primary/50 bg-primary/5',
  },
  [PoolType.FIXED_BUDGET]: {
    label: 'Fixed Budget',
    description:
      'Set a fixed dollar budget that gets distributed as bounties are completed',
    icon: Wallet02,
    color: 'border-amber-500/50 bg-amber-500/5',
  },
}

const commitmentLabel: Record<number, string> = {
  6: '6 months',
  12: '1 year',
  24: '2 years',
  36: '3 years',
  60: '5 years',
  120: '10 years',
  9999: 'Forever',
}

export function PoolEditor({
  mode,
  projectId,
  projectSlug,
  poolId,
}: PoolEditorProps) {
  const router = useRouter()
  const utils = trpc.useUtils()

  // Form state
  const [poolType, setPoolType] = useState<PoolType>(PoolType.PROFIT_SHARE)
  const [name, setName] = useState('')
  const [isDefault, setIsDefault] = useState(false)
  const [status, setStatus] = useState<PoolStatus>(PoolStatus.ACTIVE)

  // PROFIT_SHARE fields
  const [poolPercentage, setPoolPercentage] = useState(10)
  const [poolCapacity, setPoolCapacity] = useState(1000)
  const [payoutFrequency, setPayoutFrequency] = useState<
    'MONTHLY' | 'QUARTERLY'
  >('MONTHLY')
  const [commitmentMonths, setCommitmentMonths] = useState(60) // 5 years

  // FIXED_BUDGET fields
  const [budgetDollars, setBudgetDollars] = useState(1000)

  const initializedRef = useRef(false)
  const defaultInitializedRef = useRef(false)

  // Fetch existing pools to determine if this is the first pool (create mode)
  const { data: existingPools } = trpc.rewardPool.getByProject.useQuery(
    { projectId },
    { enabled: mode === 'create' },
  )

  // Set isDefault to true if this is the first pool being created
  useEffect(() => {
    if (mode === 'create' && existingPools && !defaultInitializedRef.current) {
      defaultInitializedRef.current = true
      if (existingPools.length === 0) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Initialize default for first pool
        setIsDefault(true)
      }
    }
  }, [mode, existingPools])

  // Fetch pool data for edit mode
  const { data: pool, isLoading: poolLoading } =
    trpc.rewardPool.getById.useQuery(
      { id: poolId! },
      { enabled: mode === 'edit' && !!poolId },
    )

  // Initialize form with pool data in edit mode
  useEffect(() => {
    if (mode === 'edit' && pool && !initializedRef.current) {
      initializedRef.current = true
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Form initialization from fetched data
      setPoolType(pool.poolType as PoolType)
      setName(pool.name ?? '')
      setIsDefault(pool.isDefault)
      setStatus(pool.status as PoolStatus)
      if (pool.poolPercentage != null) setPoolPercentage(pool.poolPercentage)
      if (pool.poolCapacity != null) setPoolCapacity(pool.poolCapacity)
      if (pool.payoutFrequency)
        setPayoutFrequency(pool.payoutFrequency as 'MONTHLY' | 'QUARTERLY')
      if (pool.commitmentMonths != null)
        setCommitmentMonths(pool.commitmentMonths)
      if (pool.budgetCents != null) setBudgetDollars(pool.budgetCents / 100)
    }
  }, [mode, pool])

  // Mutations
  const createPool = trpc.rewardPool.create.useMutation({
    onSuccess: () => {
      toast.success('Pool created successfully')
      utils.rewardPool.getByProject.invalidate({ projectId })
      router.push(
        routes.project.detail({ slug: projectSlug, tab: ProjectTab.POOLS }),
      )
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const updatePool = trpc.rewardPool.update.useMutation({
    onSuccess: () => {
      toast.success('Pool updated successfully')
      utils.rewardPool.getByProject.invalidate({ projectId })
      utils.rewardPool.getById.invalidate({ id: poolId! })
      router.push(
        routes.project.detail({ slug: projectSlug, tab: ProjectTab.POOLS }),
      )
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const isSubmitting = createPool.isPending || updatePool.isPending

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (mode === 'create') {
      createPool.mutate({
        projectId,
        poolType,
        name: name || undefined,
        isDefault,
        // PROFIT_SHARE fields
        ...(poolType === PoolType.PROFIT_SHARE && {
          poolPercentage,
          poolCapacity,
          payoutFrequency,
          commitmentMonths,
        }),
        // FIXED_BUDGET fields
        ...(poolType === PoolType.FIXED_BUDGET && {
          budgetCents: Math.round(budgetDollars * 100),
        }),
      })
    } else {
      updatePool.mutate({
        id: poolId!,
        name: name || null,
        isDefault,
        status,
        // PROFIT_SHARE fields (only if not locked)
        ...(poolType === PoolType.PROFIT_SHARE && {
          poolPercentage,
          poolCapacity,
          payoutFrequency,
          commitmentMonths,
        }),
        // FIXED_BUDGET fields
        ...(poolType === PoolType.FIXED_BUDGET && {
          budgetCents: Math.round(budgetDollars * 100),
        }),
      })
    }
  }

  if (mode === 'edit' && poolLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Check if pool is locked (has claimed bounties)
  const isLocked = mode === 'edit' && pool && pool._count.bounties > 0
  const submitLabel = mode === 'create' ? 'Create Pool' : 'Save Changes'

  return (
    <form onSubmit={handleSubmit}>
      {/* Main layout - matching project-editor */}
      <div className="grid gap-6 lg:grid-cols-[1fr_auto_280px]">
        {/* Main content - left side */}
        <div className="space-y-6">
          {/* Pool Type Selection (only for create mode) */}
          {mode === 'create' && (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                {Object.entries(poolTypeConfig).map(([type, config]) => {
                  const Icon = config.icon
                  const isSelected = poolType === type
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setPoolType(type as PoolType)}
                      className={cn(
                        'flex flex-col items-start rounded-lg border-2 p-4 text-left transition-all',
                        isSelected
                          ? config.color
                          : 'border-border hover:border-muted-foreground/50',
                      )}
                    >
                      <Icon
                        className={cn(
                          'size-5',
                          isSelected
                            ? 'text-foreground'
                            : 'text-muted-foreground',
                        )}
                      />
                      <span className="mt-2 font-medium">{config.label}</span>
                      <span className="mt-1 text-xs text-muted-foreground">
                        {config.description}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Main input area - bordered container */}
          <div className="rounded-lg border border-border bg-accent">
            {/* Pool name input */}
            <div className="px-4 py-3">
              <div className="mb-1 text-xs text-muted-foreground">
                Pool Name (Optional)
              </div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={`e.g., ${poolType === PoolType.PROFIT_SHARE ? 'Main Profit Share' : poolType === PoolType.FIXED_BUDGET ? 'Security Bug Bounties' : 'Feature Bounties'}`}
                maxLength={100}
                disabled={isSubmitting}
                className="w-full bg-transparent text-xl font-semibold placeholder:text-muted-foreground/50 focus:outline-none"
              />
            </div>

            <Separator />

            {/* Pool-type-specific settings */}
            {poolType === PoolType.PROFIT_SHARE && (
              <>
                <div className="space-y-4 p-4">
                  <h3 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <PieChart01 className="size-4" />
                    Profit Share Settings
                  </h3>

                  {isLocked && (
                    <p className="rounded-md bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-400">
                      Some settings are locked because this pool has bounties
                      with claims.
                    </p>
                  )}

                  {/* Pool Percentage */}
                  <div className="max-w-md space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-sm">Profit Share Percentage</label>
                      <span className="text-2xl font-bold text-primary">
                        {poolPercentage}%
                      </span>
                    </div>
                    <Slider
                      value={[poolPercentage]}
                      onValueChange={([value]) => setPoolPercentage(value)}
                      min={1}
                      max={50}
                      step={1}
                      disabled={isLocked || isSubmitting}
                    />
                    {/* Quick selects */}
                    <div className="flex flex-wrap gap-1">
                      {[5, 10, 15, 20].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setPoolPercentage(preset)}
                          disabled={isLocked || isSubmitting}
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
                        e.g. $
                        {((10000 * poolPercentage) / 100).toLocaleString()} of
                        $10,000 profit → contributors
                      </span>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Pool Capacity */}
                <div className="max-w-md space-y-3 space-x-2 p-4 pb-6">
                  <label className="text-sm">Pool Capacity (Points)</label>
                  <AppInput
                    type="number"
                    value={poolCapacity}
                    onChange={(e) =>
                      setPoolCapacity(parseInt(e.target.value) || 1000)
                    }
                    min={100}
                    disabled={isLocked || isSubmitting}
                    className="mt-2 h-9 max-w-[150px]"
                  />
                  <div className="rounded-md bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      How points work:
                    </span>{' '}
                    Points represent a contributor&apos;s share of your profit
                    pool. The more points someone earns, the larger their share
                    of each payout.
                  </div>
                  <div className="rounded-md bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      Start small (1,000 recommended).
                    </span>{' '}
                    The pool auto-expands as needed when you create more
                    bounties. This rewards early contributors with larger
                    shares.
                  </div>
                  <div className="rounded-md bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
                    Currently: 1 point = {(100 / poolCapacity).toFixed(2)}% of
                    the pool
                    {poolPercentage > 0 && (
                      <span className="text-foreground">
                        {' '}
                        (e.g. $
                        {(
                          (10000 * poolPercentage) /
                          100 /
                          poolCapacity
                        ).toFixed(0)}{' '}
                        per point on $10k profit)
                      </span>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* FIXED_BUDGET specific fields */}
            {poolType === PoolType.FIXED_BUDGET && (
              <div className="space-y-4 p-4">
                <h3 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Wallet02 className="size-4" />
                  Budget Settings
                </h3>

                <div className="max-w-md space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="text-sm">Total Budget</label>
                    <div className="relative max-w-[150px]">
                      <span className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">
                        $
                      </span>
                      <AppInput
                        type="number"
                        value={budgetDollars}
                        onChange={(e) =>
                          setBudgetDollars(parseFloat(e.target.value) || 0)
                        }
                        min={1}
                        step={1}
                        disabled={isSubmitting}
                        className="h-9 pl-7"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {poolType === PoolType.FIXED_BUDGET
                      ? 'Total amount to distribute across all bounties in this pool.'
                      : 'Total budget for per-bounty rewards'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Vertical separator */}
        <Separator orientation="vertical" className="hidden lg:block" />

        {/* Sidebar - right side */}
        <div className="space-y-4">
          {/* Submit button at top */}
          <AppButton
            type="submit"
            disabled={isSubmitting}
            className="w-full"
            size="sm"
          >
            {isSubmitting && (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            )}
            {submitLabel}
          </AppButton>

          <Separator />

          {/* Pool settings */}
          <div className="space-y-4 pt-2">
            <span className="text-xs font-medium text-muted-foreground">
              Pool settings
            </span>

            {/* Default Pool Toggle */}
            <div className="flex items-center justify-between">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-help text-xs text-muted-foreground">
                    Default Pool
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-wrap">
                  New bounties will use this pool by default
                </TooltipContent>
              </Tooltip>
              <Switch
                checked={isDefault}
                onCheckedChange={setIsDefault}
                disabled={isSubmitting}
              />
            </div>

            {/* Status (edit mode only) */}
            {mode === 'edit' && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Status</span>
                <Select
                  value={status}
                  onValueChange={(v) => setStatus(v as PoolStatus)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger className="h-7 w-28 rounded-md border-border text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={PoolStatus.ACTIVE}>Active</SelectItem>
                    <SelectItem value={PoolStatus.SUNSET}>Sunset</SelectItem>
                    <SelectItem value={PoolStatus.CLOSED}>Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* PROFIT_SHARE sidebar settings */}
            {poolType === PoolType.PROFIT_SHARE && (
              <>
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
                    onValueChange={(v) =>
                      setPayoutFrequency(v as 'MONTHLY' | 'QUARTERLY')
                    }
                    disabled={isLocked || isSubmitting}
                  >
                    <SelectTrigger className="h-7 w-24 rounded-md border-border text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MONTHLY">Monthly</SelectItem>
                      <SelectItem value="QUARTERLY">Quarterly</SelectItem>
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
                      How long you commit to sharing profits with contributors
                    </TooltipContent>
                  </Tooltip>
                  <Select
                    value={commitmentMonths.toString()}
                    onValueChange={(v) => setCommitmentMonths(parseInt(v))}
                    disabled={isLocked || isSubmitting}
                  >
                    <SelectTrigger className="h-7 w-24 rounded-md border-border text-xs">
                      <SelectValue>
                        {commitmentLabel[commitmentMonths]}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="6">6 months</SelectItem>
                      <SelectItem value="12">1 year</SelectItem>
                      <SelectItem value="24">2 years</SelectItem>
                      <SelectItem value="36">3 years</SelectItem>
                      <SelectItem value="60">5 years</SelectItem>
                      <SelectItem value="120">10 years</SelectItem>
                      <SelectItem value="9999">Forever</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>

          <Separator />

          {/* Cancel button */}
          <AppButton
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isSubmitting}
            className="w-full"
            size="sm"
          >
            Cancel
          </AppButton>
        </div>
      </div>
    </form>
  )
}
