import { BountyClaimMode } from '@/lib/db/types'

/**
 * Claim Mode Utilities
 *
 * Centralized logic for claim mode behavior. Used by:
 * - tRPC routers
 * - GitHub webhooks
 * - MCP routes
 * - UI components
 *
 * As new modes are added, extend the helpers here rather than
 * scattering conditionals throughout the codebase.
 */

// ================================
// Claim Mode Behavior Helpers
// ================================

/**
 * Whether the mode allows multiple contributors to claim simultaneously.
 * - SINGLE: No, only one person at a time
 * - COMPETITIVE: Yes, race to first approval
 * - MULTIPLE: Yes, all approved get points
 * - PERFORMANCE: Yes, unlimited participation
 */
export function allowsMultipleClaims(mode: BountyClaimMode): boolean {
  return (
    mode === BountyClaimMode.COMPETITIVE ||
    mode === BountyClaimMode.MULTIPLE ||
    mode === BountyClaimMode.PERFORMANCE
  )
}

/**
 * Whether only one contributor can work on this at a time.
 */
export function isExclusiveMode(mode: BountyClaimMode): boolean {
  return mode === BountyClaimMode.SINGLE
}

/**
 * Whether only the first approved submission gets points (others lose).
 * - SINGLE: Yes (only one can claim anyway)
 * - COMPETITIVE: Yes, first approved wins
 * - MULTIPLE: No, all approved get points
 * - PERFORMANCE: No, points per result
 */
export function isFirstWinsMode(mode: BountyClaimMode): boolean {
  return mode === BountyClaimMode.SINGLE || mode === BountyClaimMode.COMPETITIVE
}

/**
 * Whether the mode supports a maxClaims limit.
 * Only COMPETITIVE and MULTIPLE modes use maxClaims.
 */
export function supportsMaxClaims(mode: BountyClaimMode): boolean {
  return (
    mode === BountyClaimMode.COMPETITIVE || mode === BountyClaimMode.MULTIPLE
  )
}

/**
 * Whether the bounty should reopen when all claims are released.
 * Only SINGLE mode bounties reopen automatically.
 */
export function shouldReopenOnClaimRelease(mode: BountyClaimMode): boolean {
  return mode === BountyClaimMode.SINGLE
}

// ================================
// UI Labels & Descriptions
// ================================

export interface ClaimModeInfo {
  label: string
  shortLabel: string
  description: string
  contributorHint: string
}

const CLAIM_MODE_INFO: Record<BountyClaimMode, ClaimModeInfo> = {
  [BountyClaimMode.SINGLE]: {
    label: 'Exclusive',
    shortLabel: 'Exclusive',
    description: 'One contributor claims and works on this exclusively.',
    contributorHint: 'Claim to start working. Others must wait.',
  },
  [BountyClaimMode.COMPETITIVE]: {
    label: 'Competitive',
    shortLabel: 'Competitive',
    description: 'Multiple can claim, but only the first approved wins.',
    contributorHint: 'Race to get approved first. Only one winner.',
  },
  [BountyClaimMode.MULTIPLE]: {
    label: 'Multiple',
    shortLabel: 'Multiple',
    description: 'Multiple can complete. All approved get points.',
    contributorHint: 'Everyone who completes this gets rewarded.',
  },
  [BountyClaimMode.PERFORMANCE]: {
    label: 'Performance',
    shortLabel: 'Performance',
    description: 'Points awarded per verified result (referrals, leads, etc.).',
    contributorHint: 'Earn points for each result you drive.',
  },
}

/**
 * Get display info for a claim mode.
 */
export function getClaimModeInfo(mode: BountyClaimMode): ClaimModeInfo {
  return (
    CLAIM_MODE_INFO[mode] ?? {
      label: mode,
      shortLabel: mode,
      description: '',
      contributorHint: '',
    }
  )
}

/**
 * Get all available claim modes with their info.
 * Useful for populating dropdowns.
 */
export function getAllClaimModes(): Array<{
  value: BountyClaimMode
  info: ClaimModeInfo
}> {
  return Object.values(BountyClaimMode).map((mode) => ({
    value: mode,
    info: CLAIM_MODE_INFO[mode],
  }))
}

/**
 * Modes that are fully implemented and available for use.
 * PERFORMANCE is listed but will need additional UI/backend work.
 */
export function getAvailableClaimModes(): BountyClaimMode[] {
  // For MVP, only expose SINGLE, COMPETITIVE, and MULTIPLE
  // PERFORMANCE requires additional infrastructure (result tracking, etc.)
  return [
    BountyClaimMode.SINGLE,
    BountyClaimMode.COMPETITIVE,
    BountyClaimMode.MULTIPLE,
    // BountyClaimMode.PERFORMANCE, // Enable when performance bounties are ready
  ]
}

// ================================
// Completion Logic Helpers
// ================================

/**
 * Determines if a bounty should be marked COMPLETED after a submission approval.
 *
 * @param mode - The bounty's claim mode
 * @param approvedCount - Number of approved submissions after this approval
 * @param maxClaims - Optional max claims/completions limit (for MULTIPLE mode)
 * @returns true if bounty should be marked COMPLETED
 */
export function shouldCompleteBountyOnApproval(
  mode: BountyClaimMode,
  approvedCount: number,
  maxClaims: number | null,
): boolean {
  switch (mode) {
    case BountyClaimMode.SINGLE:
      // SINGLE: Always complete on first (and only) approval
      return true

    case BountyClaimMode.COMPETITIVE:
      // COMPETITIVE: First approval wins, bounty completes
      return true

    case BountyClaimMode.MULTIPLE:
      // MULTIPLE: Only complete when maxClaims completions reached (if set)
      // If no limit, bounty stays open indefinitely until manually closed
      return maxClaims !== null && approvedCount >= maxClaims

    case BountyClaimMode.PERFORMANCE:
      // PERFORMANCE: Never auto-complete, runs until manually closed
      return false

    default:
      // Unknown mode, default to completing
      return true
  }
}

/**
 * For COMPETITIVE mode, when first submission is approved,
 * other claims should be expired and their submissions withdrawn.
 */
export function shouldExpireOtherClaimsOnApproval(
  mode: BountyClaimMode,
): boolean {
  return mode === BountyClaimMode.COMPETITIVE
}
