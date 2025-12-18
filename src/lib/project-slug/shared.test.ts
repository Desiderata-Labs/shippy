import {
  PROJECT_SLUG_MAX_LENGTH,
  PROJECT_SLUG_MIN_LENGTH,
  RESERVED_PROJECT_SLUGS,
  isAdminEmail,
  slugifyProjectSlug,
  validateProjectSlug,
} from './shared'
import { describe, expect, test } from 'vitest'

// ================================
// isAdminEmail Tests
// ================================

describe('isAdminEmail', () => {
  test('returns true for admin email', () => {
    expect(isAdminEmail('rob@robphillips.me')).toBe(true)
  })

  test('returns true for admin email case-insensitive', () => {
    expect(isAdminEmail('Rob@RobPhillips.ME')).toBe(true)
  })

  test('returns false for non-admin email', () => {
    expect(isAdminEmail('user@example.com')).toBe(false)
  })

  test('returns false for null', () => {
    expect(isAdminEmail(null)).toBe(false)
  })

  test('returns false for undefined', () => {
    expect(isAdminEmail(undefined)).toBe(false)
  })

  test('returns false for empty string', () => {
    expect(isAdminEmail('')).toBe(false)
  })
})

// ================================
// slugifyProjectSlug Tests
// ================================

describe('slugifyProjectSlug', () => {
  test('converts to lowercase', () => {
    expect(slugifyProjectSlug('MyProject')).toBe('myproject')
  })

  test('converts spaces to dashes', () => {
    expect(slugifyProjectSlug('My Project')).toBe('my-project')
  })

  test('removes special characters', () => {
    expect(slugifyProjectSlug('My Project!')).toBe('my-project')
  })

  test('collapses multiple dashes', () => {
    expect(slugifyProjectSlug('My - Project')).toBe('my-project')
  })

  test('removes leading/trailing dashes', () => {
    expect(slugifyProjectSlug('-My Project-')).toBe('my-project')
  })

  test('handles diacritics', () => {
    expect(slugifyProjectSlug('Café')).toBe('cafe')
  })

  test('truncates to max length', () => {
    const longName = 'a'.repeat(100)
    const slug = slugifyProjectSlug(longName)
    expect(slug.length).toBeLessThanOrEqual(PROJECT_SLUG_MAX_LENGTH)
  })
})

// ================================
// validateProjectSlug Tests
// ================================

describe('validateProjectSlug', () => {
  describe('valid slugs', () => {
    const validSlugs = [
      'my-project',
      'myproject',
      'my-app-123',
      'a1',
      'ab',
      'project1',
      '123project',
    ]

    test.each(validSlugs)('accepts valid slug: %s', (slug) => {
      const result = validateProjectSlug(slug)
      expect(result.isValid).toBe(true)
      expect(result.error).toBeUndefined()
    })
  })

  describe('length validation', () => {
    test('rejects slug shorter than minimum', () => {
      const result = validateProjectSlug('a')
      expect(result.isValid).toBe(false)
      expect(result.error).toContain(`${PROJECT_SLUG_MIN_LENGTH}`)
    })

    test('rejects slug longer than maximum', () => {
      const longSlug = 'a'.repeat(PROJECT_SLUG_MAX_LENGTH + 1)
      const result = validateProjectSlug(longSlug)
      expect(result.isValid).toBe(false)
      expect(result.error).toContain(`${PROJECT_SLUG_MAX_LENGTH}`)
    })

    test('accepts slug at minimum length', () => {
      const minSlug = 'a'.repeat(PROJECT_SLUG_MIN_LENGTH)
      const result = validateProjectSlug(minSlug)
      expect(result.isValid).toBe(true)
    })

    test('accepts slug at maximum length', () => {
      const maxSlug = 'a'.repeat(PROJECT_SLUG_MAX_LENGTH)
      const result = validateProjectSlug(maxSlug)
      expect(result.isValid).toBe(true)
    })
  })

  describe('format validation', () => {
    test('rejects slug starting with dash', () => {
      const result = validateProjectSlug('-myproject')
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('cannot start or end with a dash')
    })

    test('rejects slug ending with dash', () => {
      const result = validateProjectSlug('myproject-')
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('cannot start or end with a dash')
    })

    test('accepts slug with uppercase letters (normalizes to lowercase)', () => {
      // The validation normalizes to lowercase first, so uppercase is accepted
      const result = validateProjectSlug('MyProject')
      expect(result.isValid).toBe(true)
    })

    test('rejects slug with spaces', () => {
      const result = validateProjectSlug('my project')
      expect(result.isValid).toBe(false)
    })

    test('rejects slug with underscores', () => {
      const result = validateProjectSlug('my_project')
      expect(result.isValid).toBe(false)
    })

    test('rejects slug with special characters', () => {
      const result = validateProjectSlug('my@project')
      expect(result.isValid).toBe(false)
    })
  })

  describe('empty/null handling', () => {
    test('rejects empty string', () => {
      const result = validateProjectSlug('')
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('required')
    })

    test('rejects whitespace-only string', () => {
      const result = validateProjectSlug('   ')
      expect(result.isValid).toBe(false)
    })
  })

  describe('reserved slugs', () => {
    test('rejects reserved slugs for regular users', () => {
      for (const reserved of RESERVED_PROJECT_SLUGS) {
        const result = validateProjectSlug(reserved)
        expect(result.isValid).toBe(false)
        expect(result.error).toContain('reserved')
      }
    })

    test('allows reserved slugs for admin users', () => {
      // At least one reserved slug should work for admin
      const result = validateProjectSlug('shippy', 'rob@robphillips.me')
      expect(result.isValid).toBe(true)
    })

    test('rejects reserved slugs for non-admin users', () => {
      const result = validateProjectSlug('shippy', 'user@example.com')
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('reserved')
    })
  })

  describe('case normalization', () => {
    test('normalizes to lowercase during validation', () => {
      // The validator normalizes to lowercase, so uppercase input is valid
      const result = validateProjectSlug('MYPROJECT')
      expect(result.isValid).toBe(true)
    })

    test('normalizes mixed case to lowercase', () => {
      const result = validateProjectSlug('MyProject')
      expect(result.isValid).toBe(true)
    })
  })
})

// ================================
// Reserved Slugs Coverage
// ================================

describe('Reserved Project Slugs', () => {
  test('contains platform routes', () => {
    expect(RESERVED_PROJECT_SLUGS.has('admin')).toBe(true)
    expect(RESERVED_PROJECT_SLUGS.has('api')).toBe(true)
    expect(RESERVED_PROJECT_SLUGS.has('dashboard')).toBe(true)
  })

  test('contains common reserved names', () => {
    expect(RESERVED_PROJECT_SLUGS.has('test')).toBe(true)
    expect(RESERVED_PROJECT_SLUGS.has('demo')).toBe(true)
    expect(RESERVED_PROJECT_SLUGS.has('example')).toBe(true)
  })

  test('contains brand protection slugs', () => {
    expect(RESERVED_PROJECT_SLUGS.has('shippy')).toBe(true)
  })
})
