import { useCallback, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { SubmissionStatus } from '@/lib/db/types'

export interface SubmissionFiltersState {
  statuses: SubmissionStatus[]
}

export interface FilterableSubmission {
  id: string
  status: string
  createdAt: Date
  user: {
    id: string
    name: string
    image: string | null
    username: string | null
  }
  _count: {
    events: number
  }
}

// Encode filter state to URL param
function encodeFilters(filters: SubmissionFiltersState): string | null {
  if (filters.statuses.length === 0) {
    return null
  }
  // Use short format: comma-separated statuses
  return filters.statuses.join(',')
}

// Decode filter state from URL param
function decodeFilters(encoded: string | null): SubmissionFiltersState {
  if (!encoded) {
    return { statuses: [] }
  }
  try {
    const statuses = encoded.split(',').filter(Boolean) as SubmissionStatus[]
    return { statuses }
  } catch {
    return { statuses: [] }
  }
}

interface UseSubmissionFiltersOptions {
  submissions: FilterableSubmission[]
}

export function useSubmissionFilters({
  submissions,
}: UseSubmissionFiltersOptions) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const filterParam = searchParams.get('sf') // "sf" = submission filter

  // Read filter state from URL
  const filters = useMemo(() => decodeFilters(filterParam), [filterParam])

  // Update URL when filters change
  const setFilters = useCallback(
    (newFilters: SubmissionFiltersState) => {
      const params = new URLSearchParams(searchParams.toString())
      const encoded = encodeFilters(newFilters)

      if (encoded) {
        params.set('sf', encoded)
      } else {
        params.delete('sf')
      }

      const query = params.toString()
      router.replace(`${pathname}${query ? `?${query}` : ''}`, {
        scroll: false,
      })
    },
    [router, pathname, searchParams],
  )

  // Status counts for filter UI (from unfiltered submissions)
  const statusCounts = useMemo(
    () => ({
      [SubmissionStatus.DRAFT]: submissions.filter(
        (s) => s.status === SubmissionStatus.DRAFT,
      ).length,
      [SubmissionStatus.PENDING]: submissions.filter(
        (s) => s.status === SubmissionStatus.PENDING,
      ).length,
      [SubmissionStatus.NEEDS_INFO]: submissions.filter(
        (s) => s.status === SubmissionStatus.NEEDS_INFO,
      ).length,
      [SubmissionStatus.APPROVED]: submissions.filter(
        (s) => s.status === SubmissionStatus.APPROVED,
      ).length,
      [SubmissionStatus.REJECTED]: submissions.filter(
        (s) => s.status === SubmissionStatus.REJECTED,
      ).length,
      [SubmissionStatus.WITHDRAWN]: submissions.filter(
        (s) => s.status === SubmissionStatus.WITHDRAWN,
      ).length,
    }),
    [submissions],
  )

  // Apply filters to submissions
  const filteredSubmissions = useMemo(() => {
    let result = submissions

    // Filter by status (if any selected)
    if (filters.statuses.length > 0) {
      result = result.filter((s) =>
        filters.statuses.includes(s.status as SubmissionStatus),
      )
    }

    // Sort: pending/needs_info first, then by date
    return result.sort((a, b) => {
      const priority: Record<string, number> = {
        [SubmissionStatus.PENDING]: 0,
        [SubmissionStatus.NEEDS_INFO]: 1,
      }
      const aPriority = priority[a.status] ?? 99
      const bPriority = priority[b.status] ?? 99

      if (aPriority !== bPriority) return aPriority - bPriority
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  }, [submissions, filters])

  const hasActiveFilters = filters.statuses.length > 0

  return {
    filters,
    setFilters,
    hasActiveFilters,
    statusCounts,
    filteredSubmissions,
  }
}
