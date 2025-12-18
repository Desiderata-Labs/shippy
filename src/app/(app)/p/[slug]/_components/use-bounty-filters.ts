import { useCallback, useEffect, useMemo, useRef } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { BountyStatus } from '@/lib/db/types'

export interface BountyFiltersState {
  statuses: BountyStatus[]
  labelIds: string[]
}

export interface BountyLabel {
  label: {
    id: string
    name: string
    color: string
  }
}

export interface FilterableBounty {
  status: string
  labels: BountyLabel[]
  _count: {
    pendingSubmissions: number
  }
}

// Encode filter state to a compact base64 string
function encodeFilters(filters: BountyFiltersState): string | null {
  if (filters.statuses.length === 0 && filters.labelIds.length === 0) {
    return null
  }
  // Use short keys for compactness: s = statuses, l = labelIds
  const compact = {
    ...(filters.statuses.length > 0 && { s: filters.statuses }),
    ...(filters.labelIds.length > 0 && { l: filters.labelIds }),
  }
  return btoa(JSON.stringify(compact))
}

// Decode filter state from a base64 string
function decodeFilters(encoded: string | null): BountyFiltersState {
  if (!encoded) {
    return { statuses: [], labelIds: [] }
  }
  try {
    const compact = JSON.parse(atob(encoded)) as { s?: string[]; l?: string[] }
    return {
      statuses: (compact.s ?? []) as BountyStatus[],
      labelIds: compact.l ?? [],
    }
  } catch {
    return { statuses: [], labelIds: [] }
  }
}

// localStorage key for persisting filters per project
function getStorageKey(projectSlug: string): string {
  return `bounty-filters:${projectSlug}`
}

// Save filters to localStorage
function saveFiltersToStorage(projectSlug: string, encoded: string | null) {
  try {
    if (encoded) {
      localStorage.setItem(getStorageKey(projectSlug), encoded)
    } else {
      localStorage.removeItem(getStorageKey(projectSlug))
    }
  } catch {
    // localStorage not available (SSR, private mode, etc.)
  }
}

// Load filters from localStorage
function loadFiltersFromStorage(projectSlug: string): string | null {
  try {
    return localStorage.getItem(getStorageKey(projectSlug))
  } catch {
    return null
  }
}

interface UseBountyFiltersOptions<T extends FilterableBounty> {
  projectSlug: string
  bounties: T[]
}

export function useBountyFilters<T extends FilterableBounty>({
  projectSlug,
  bounties,
}: UseBountyFiltersOptions<T>) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const hasRestoredFromStorage = useRef(false)

  const urlFilterParam = searchParams.get('f')

  // Read filter state from URL, falling back to empty
  const filters = useMemo(() => decodeFilters(urlFilterParam), [urlFilterParam])

  // On mount, restore from localStorage if no URL param
  useEffect(() => {
    if (hasRestoredFromStorage.current) return
    hasRestoredFromStorage.current = true

    // If URL already has filters, don't override
    if (urlFilterParam) return

    const stored = loadFiltersFromStorage(projectSlug)
    if (stored) {
      const params = new URLSearchParams(searchParams.toString())
      params.set('f', stored)
      const query = params.toString()
      router.replace(`${pathname}${query ? `?${query}` : ''}`, {
        scroll: false,
      })
    }
  }, [projectSlug, urlFilterParam, pathname, router, searchParams])

  // Update URL and localStorage when filters change
  const setFilters = useCallback(
    (newFilters: BountyFiltersState) => {
      const params = new URLSearchParams(searchParams.toString())
      const encoded = encodeFilters(newFilters)

      if (encoded) {
        params.set('f', encoded)
      } else {
        params.delete('f')
      }

      // Persist to localStorage
      saveFiltersToStorage(projectSlug, encoded)

      const query = params.toString()
      router.replace(`${pathname}${query ? `?${query}` : ''}`, {
        scroll: false,
      })
    },
    [router, pathname, searchParams, projectSlug],
  )

  // Extract unique labels from all bounties
  const allLabels = useMemo(
    () =>
      bounties
        .flatMap((b) => b.labels.map((l) => l.label))
        .filter(
          (label, index, self) =>
            self.findIndex((l) => l.id === label.id) === index,
        )
        .sort((a, b) => a.name.localeCompare(b.name)),
    [bounties],
  )

  // Status counts for filter UI (from unfiltered bounties)
  const statusCounts = useMemo(
    () => ({
      [BountyStatus.OPEN]: bounties.filter(
        (b) => b.status === BountyStatus.OPEN,
      ).length,
      [BountyStatus.CLAIMED]: bounties.filter(
        (b) => b.status === BountyStatus.CLAIMED,
      ).length,
      [BountyStatus.COMPLETED]: bounties.filter(
        (b) => b.status === BountyStatus.COMPLETED,
      ).length,
      [BountyStatus.BACKLOG]: bounties.filter(
        (b) => b.status === BountyStatus.BACKLOG,
      ).length,
      [BountyStatus.CLOSED]: bounties.filter(
        (b) => b.status === BountyStatus.CLOSED,
      ).length,
    }),
    [bounties],
  )

  // Apply filters to bounties
  const filteredBounties = useMemo(() => {
    let result = bounties

    // Filter by status (if any selected)
    if (filters.statuses.length > 0) {
      result = result.filter((b) =>
        filters.statuses.includes(b.status as BountyStatus),
      )
    }

    // Filter by labels (if any selected - bounty must have at least one of the selected labels)
    if (filters.labelIds.length > 0) {
      result = result.filter((b) =>
        b.labels.some((l) => filters.labelIds.includes(l.label.id)),
      )
    }

    return result
  }, [bounties, filters])

  const hasActiveFilters =
    filters.statuses.length > 0 || filters.labelIds.length > 0

  // Group filtered bounties by status
  const groupedBounties = useMemo(() => {
    const open = filteredBounties.filter((b) => b.status === BountyStatus.OPEN)
    const backlog = filteredBounties.filter(
      (b) => b.status === BountyStatus.BACKLOG,
    )
    const needsReview = filteredBounties.filter(
      (b) => b._count.pendingSubmissions > 0,
    )
    const inProgress = filteredBounties.filter(
      (b) =>
        b.status === BountyStatus.CLAIMED && b._count.pendingSubmissions === 0,
    )
    const completed = filteredBounties.filter(
      (b) => b.status === BountyStatus.COMPLETED,
    )
    const closed = filteredBounties.filter(
      (b) => b.status === BountyStatus.CLOSED,
    )

    return { open, backlog, needsReview, inProgress, completed, closed }
  }, [filteredBounties])

  return {
    filters,
    setFilters,
    hasActiveFilters,
    allLabels,
    statusCounts,
    filteredBounties,
    groupedBounties,
  }
}
