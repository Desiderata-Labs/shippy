import { BountyClaimMode } from '@/lib/db/types'
import {
  allowsMultipleClaims,
  allowsMultipleSubmissionsPerUser,
  getAllClaimModes,
  getAvailableClaimModes,
  getClaimModeInfo,
  isExclusiveMode,
  isFirstWinsMode,
  shouldCompleteBountyOnApproval,
  shouldExpireOtherClaimsOnApproval,
  shouldReopenOnClaimRelease,
  supportsMaxClaims,
} from './claim-modes'
import { describe, expect, test } from 'vitest'

// ================================
// allowsMultipleClaims
// ================================

describe('allowsMultipleClaims', () => {
  test('SINGLE mode does NOT allow multiple claims', () => {
    expect(allowsMultipleClaims(BountyClaimMode.SINGLE)).toBe(false)
  })

  test('COMPETITIVE mode allows multiple claims', () => {
    expect(allowsMultipleClaims(BountyClaimMode.COMPETITIVE)).toBe(true)
  })

  test('MULTIPLE mode allows multiple claims', () => {
    expect(allowsMultipleClaims(BountyClaimMode.MULTIPLE)).toBe(true)
  })

  test('PERFORMANCE mode allows multiple claims', () => {
    expect(allowsMultipleClaims(BountyClaimMode.PERFORMANCE)).toBe(true)
  })
})

// ================================
// isExclusiveMode
// ================================

describe('isExclusiveMode', () => {
  test('SINGLE mode is exclusive', () => {
    expect(isExclusiveMode(BountyClaimMode.SINGLE)).toBe(true)
  })

  test('COMPETITIVE mode is NOT exclusive', () => {
    expect(isExclusiveMode(BountyClaimMode.COMPETITIVE)).toBe(false)
  })

  test('MULTIPLE mode is NOT exclusive', () => {
    expect(isExclusiveMode(BountyClaimMode.MULTIPLE)).toBe(false)
  })

  test('PERFORMANCE mode is NOT exclusive', () => {
    expect(isExclusiveMode(BountyClaimMode.PERFORMANCE)).toBe(false)
  })
})

// ================================
// isFirstWinsMode
// ================================

describe('isFirstWinsMode', () => {
  test('SINGLE mode is first-wins (only one can claim anyway)', () => {
    expect(isFirstWinsMode(BountyClaimMode.SINGLE)).toBe(true)
  })

  test('COMPETITIVE mode is first-wins', () => {
    expect(isFirstWinsMode(BountyClaimMode.COMPETITIVE)).toBe(true)
  })

  test('MULTIPLE mode is NOT first-wins (all approved get points)', () => {
    expect(isFirstWinsMode(BountyClaimMode.MULTIPLE)).toBe(false)
  })

  test('PERFORMANCE mode is NOT first-wins (points per result)', () => {
    expect(isFirstWinsMode(BountyClaimMode.PERFORMANCE)).toBe(false)
  })
})

// ================================
// supportsMaxClaims
// ================================

describe('supportsMaxClaims', () => {
  test('SINGLE mode does NOT support maxClaims', () => {
    expect(supportsMaxClaims(BountyClaimMode.SINGLE)).toBe(false)
  })

  test('COMPETITIVE mode supports maxClaims', () => {
    expect(supportsMaxClaims(BountyClaimMode.COMPETITIVE)).toBe(true)
  })

  test('MULTIPLE mode supports maxClaims', () => {
    expect(supportsMaxClaims(BountyClaimMode.MULTIPLE)).toBe(true)
  })

  test('PERFORMANCE mode does NOT support maxClaims', () => {
    expect(supportsMaxClaims(BountyClaimMode.PERFORMANCE)).toBe(false)
  })
})

// ================================
// allowsMultipleSubmissionsPerUser
// ================================

describe('allowsMultipleSubmissionsPerUser', () => {
  test('SINGLE mode does NOT allow multiple submissions per user', () => {
    expect(allowsMultipleSubmissionsPerUser(BountyClaimMode.SINGLE)).toBe(false)
  })

  test('COMPETITIVE mode does NOT allow multiple submissions per user', () => {
    expect(allowsMultipleSubmissionsPerUser(BountyClaimMode.COMPETITIVE)).toBe(
      false,
    )
  })

  test('MULTIPLE mode allows multiple submissions per user', () => {
    expect(allowsMultipleSubmissionsPerUser(BountyClaimMode.MULTIPLE)).toBe(
      true,
    )
  })

  test('PERFORMANCE mode allows multiple submissions per user', () => {
    expect(allowsMultipleSubmissionsPerUser(BountyClaimMode.PERFORMANCE)).toBe(
      true,
    )
  })
})

// ================================
// shouldReopenOnClaimRelease
// ================================

describe('shouldReopenOnClaimRelease', () => {
  test('SINGLE mode should reopen when claim released', () => {
    expect(shouldReopenOnClaimRelease(BountyClaimMode.SINGLE)).toBe(true)
  })

  test('COMPETITIVE mode should NOT reopen when claim released', () => {
    expect(shouldReopenOnClaimRelease(BountyClaimMode.COMPETITIVE)).toBe(false)
  })

  test('MULTIPLE mode should NOT reopen when claim released', () => {
    expect(shouldReopenOnClaimRelease(BountyClaimMode.MULTIPLE)).toBe(false)
  })

  test('PERFORMANCE mode should NOT reopen when claim released', () => {
    expect(shouldReopenOnClaimRelease(BountyClaimMode.PERFORMANCE)).toBe(false)
  })
})

// ================================
// getClaimModeInfo
// ================================

describe('getClaimModeInfo', () => {
  test('returns info for SINGLE mode', () => {
    const info = getClaimModeInfo(BountyClaimMode.SINGLE)
    expect(info.label).toBe('Exclusive')
    expect(info.shortLabel).toBe('Exclusive')
    expect(info.description).toContain('exclusively')
    expect(info.contributorHint).toBeDefined()
  })

  test('returns info for COMPETITIVE mode', () => {
    const info = getClaimModeInfo(BountyClaimMode.COMPETITIVE)
    expect(info.label).toBe('Competitive')
    expect(info.description).toContain('first approved wins')
  })

  test('returns info for MULTIPLE mode', () => {
    const info = getClaimModeInfo(BountyClaimMode.MULTIPLE)
    expect(info.label).toBe('Multiple')
    expect(info.description).toContain('All approved get points')
  })

  test('returns info for PERFORMANCE mode', () => {
    const info = getClaimModeInfo(BountyClaimMode.PERFORMANCE)
    expect(info.label).toBe('Performance')
    expect(info.description).toContain('per verified result')
  })

  test('returns fallback for unknown mode', () => {
    // Cast to force an unknown mode through
    const info = getClaimModeInfo('UNKNOWN' as BountyClaimMode)
    expect(info.label).toBe('UNKNOWN')
    expect(info.description).toBe('')
  })
})

// ================================
// getAllClaimModes
// ================================

describe('getAllClaimModes', () => {
  test('returns all four claim modes', () => {
    const modes = getAllClaimModes()
    expect(modes).toHaveLength(4)

    const modeValues = modes.map((m) => m.value)
    expect(modeValues).toContain(BountyClaimMode.SINGLE)
    expect(modeValues).toContain(BountyClaimMode.COMPETITIVE)
    expect(modeValues).toContain(BountyClaimMode.MULTIPLE)
    expect(modeValues).toContain(BountyClaimMode.PERFORMANCE)
  })

  test('each mode has associated info', () => {
    const modes = getAllClaimModes()
    for (const { info } of modes) {
      expect(info.label).toBeDefined()
      expect(info.shortLabel).toBeDefined()
      expect(info.description).toBeDefined()
      expect(info.contributorHint).toBeDefined()
    }
  })
})

// ================================
// getAvailableClaimModes
// ================================

describe('getAvailableClaimModes', () => {
  test('returns MVP modes (excludes PERFORMANCE)', () => {
    const modes = getAvailableClaimModes()
    expect(modes).toContain(BountyClaimMode.SINGLE)
    expect(modes).toContain(BountyClaimMode.COMPETITIVE)
    expect(modes).toContain(BountyClaimMode.MULTIPLE)
    // PERFORMANCE is commented out for MVP
    expect(modes).not.toContain(BountyClaimMode.PERFORMANCE)
  })
})

// ================================
// shouldCompleteBountyOnApproval
// ================================

describe('shouldCompleteBountyOnApproval', () => {
  describe('SINGLE mode', () => {
    test('always completes on first approval', () => {
      expect(
        shouldCompleteBountyOnApproval(BountyClaimMode.SINGLE, 1, null),
      ).toBe(true)
    })

    test('completes regardless of maxClaims (not applicable)', () => {
      expect(
        shouldCompleteBountyOnApproval(BountyClaimMode.SINGLE, 1, 10),
      ).toBe(true)
    })
  })

  describe('COMPETITIVE mode', () => {
    test('completes on first approval (first wins)', () => {
      expect(
        shouldCompleteBountyOnApproval(BountyClaimMode.COMPETITIVE, 1, null),
      ).toBe(true)
    })

    test('completes regardless of maxClaims', () => {
      expect(
        shouldCompleteBountyOnApproval(BountyClaimMode.COMPETITIVE, 1, 5),
      ).toBe(true)
    })
  })

  describe('MULTIPLE mode', () => {
    test('does NOT complete when no maxClaims limit', () => {
      expect(
        shouldCompleteBountyOnApproval(BountyClaimMode.MULTIPLE, 1, null),
      ).toBe(false)
      expect(
        shouldCompleteBountyOnApproval(BountyClaimMode.MULTIPLE, 5, null),
      ).toBe(false)
      expect(
        shouldCompleteBountyOnApproval(BountyClaimMode.MULTIPLE, 100, null),
      ).toBe(false)
    })

    test('does NOT complete when approvedCount < maxClaims', () => {
      expect(
        shouldCompleteBountyOnApproval(BountyClaimMode.MULTIPLE, 1, 5),
      ).toBe(false)
      expect(
        shouldCompleteBountyOnApproval(BountyClaimMode.MULTIPLE, 4, 5),
      ).toBe(false)
    })

    test('completes when approvedCount reaches maxClaims', () => {
      expect(
        shouldCompleteBountyOnApproval(BountyClaimMode.MULTIPLE, 5, 5),
      ).toBe(true)
    })

    test('completes when approvedCount exceeds maxClaims', () => {
      // Edge case: should not happen, but handle gracefully
      expect(
        shouldCompleteBountyOnApproval(BountyClaimMode.MULTIPLE, 6, 5),
      ).toBe(true)
    })
  })

  describe('PERFORMANCE mode', () => {
    test('never auto-completes (runs until manually closed)', () => {
      expect(
        shouldCompleteBountyOnApproval(BountyClaimMode.PERFORMANCE, 1, null),
      ).toBe(false)
      expect(
        shouldCompleteBountyOnApproval(BountyClaimMode.PERFORMANCE, 100, null),
      ).toBe(false)
      expect(
        shouldCompleteBountyOnApproval(BountyClaimMode.PERFORMANCE, 1000, 10),
      ).toBe(false)
    })
  })
})

// ================================
// shouldExpireOtherClaimsOnApproval
// ================================

describe('shouldExpireOtherClaimsOnApproval', () => {
  test('SINGLE mode does NOT expire other claims (only one can claim)', () => {
    expect(shouldExpireOtherClaimsOnApproval(BountyClaimMode.SINGLE)).toBe(
      false,
    )
  })

  test('COMPETITIVE mode expires other claims (first wins)', () => {
    expect(shouldExpireOtherClaimsOnApproval(BountyClaimMode.COMPETITIVE)).toBe(
      true,
    )
  })

  test('MULTIPLE mode does NOT expire other claims (all get points)', () => {
    expect(shouldExpireOtherClaimsOnApproval(BountyClaimMode.MULTIPLE)).toBe(
      false,
    )
  })

  test('PERFORMANCE mode does NOT expire other claims', () => {
    expect(shouldExpireOtherClaimsOnApproval(BountyClaimMode.PERFORMANCE)).toBe(
      false,
    )
  })
})

// ================================
// Truth Table Tests
// ================================

describe('Claim Mode Truth Tables', () => {
  /**
   * This test verifies the claim mode behavior matrix from the PRD:
   *
   * | Mode        | Multiple Claims | Exclusive | First Wins | Max Claims | Multi-Submit | Reopen on Release | Expire Others |
   * |-------------|-----------------|-----------|------------|------------|--------------|-------------------|---------------|
   * | SINGLE      | ❌              | ✅        | ✅         | ❌         | ❌           | ✅                | ❌            |
   * | COMPETITIVE | ✅              | ❌        | ✅         | ✅         | ❌           | ❌                | ✅            |
   * | MULTIPLE    | ✅              | ❌        | ❌         | ✅         | ✅           | ❌                | ❌            |
   * | PERFORMANCE | ✅              | ❌        | ❌         | ❌         | ✅           | ❌                | ❌            |
   */

  const truthTable = [
    {
      mode: BountyClaimMode.SINGLE,
      multipleClaims: false,
      exclusive: true,
      firstWins: true,
      maxClaims: false,
      multiSubmit: false,
      reopenOnRelease: true,
      expireOthers: false,
    },
    {
      mode: BountyClaimMode.COMPETITIVE,
      multipleClaims: true,
      exclusive: false,
      firstWins: true,
      maxClaims: true,
      multiSubmit: false,
      reopenOnRelease: false,
      expireOthers: true,
    },
    {
      mode: BountyClaimMode.MULTIPLE,
      multipleClaims: true,
      exclusive: false,
      firstWins: false,
      maxClaims: true,
      multiSubmit: true,
      reopenOnRelease: false,
      expireOthers: false,
    },
    {
      mode: BountyClaimMode.PERFORMANCE,
      multipleClaims: true,
      exclusive: false,
      firstWins: false,
      maxClaims: false,
      multiSubmit: true,
      reopenOnRelease: false,
      expireOthers: false,
    },
  ]

  test.each(truthTable)(
    '$mode mode has correct behavior flags',
    ({
      mode,
      multipleClaims,
      exclusive,
      firstWins,
      maxClaims: supportsMaxClaimsExpected,
      multiSubmit,
      reopenOnRelease,
      expireOthers,
    }) => {
      expect(allowsMultipleClaims(mode)).toBe(multipleClaims)
      expect(isExclusiveMode(mode)).toBe(exclusive)
      expect(isFirstWinsMode(mode)).toBe(firstWins)
      expect(supportsMaxClaims(mode)).toBe(supportsMaxClaimsExpected)
      expect(allowsMultipleSubmissionsPerUser(mode)).toBe(multiSubmit)
      expect(shouldReopenOnClaimRelease(mode)).toBe(reopenOnRelease)
      expect(shouldExpireOtherClaimsOnApproval(mode)).toBe(expireOthers)
    },
  )
})
