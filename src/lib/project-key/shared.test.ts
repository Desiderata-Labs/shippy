import {
  PROJECT_KEY_LENGTH,
  normalizeProjectKey,
  suggestProjectKeyFromName,
  validateProjectKey,
} from './shared'
import { describe, expect, test } from 'vitest'

// ================================
// normalizeProjectKey Tests
// ================================

describe('normalizeProjectKey', () => {
  test('uppercases letters', () => {
    expect(normalizeProjectKey('abc')).toBe('ABC')
  })

  test('removes numbers', () => {
    expect(normalizeProjectKey('a1b2c3')).toBe('ABC')
  })

  test('removes special characters', () => {
    expect(normalizeProjectKey('a-b_c!')).toBe('ABC')
  })

  test('removes diacritics', () => {
    expect(normalizeProjectKey('àbç')).toBe('ABC')
    expect(normalizeProjectKey('éëê')).toBe('EEE')
  })

  test('truncates to PROJECT_KEY_LENGTH', () => {
    expect(normalizeProjectKey('abcdef')).toBe('ABC')
    expect(normalizeProjectKey('abcdef')).toHaveLength(PROJECT_KEY_LENGTH)
  })

  test('handles empty input', () => {
    expect(normalizeProjectKey('')).toBe('')
  })

  test('handles spaces', () => {
    expect(normalizeProjectKey('a b c')).toBe('ABC')
  })

  test('handles mixed case', () => {
    expect(normalizeProjectKey('AbC')).toBe('ABC')
  })
})

// ================================
// validateProjectKey Tests
// ================================

describe('validateProjectKey', () => {
  describe('valid keys', () => {
    const validKeys = ['ABC', 'XYZ', 'SHP', 'EAS', 'OAT', 'abc', 'AbC']

    test.each(validKeys)('accepts valid key: %s', (key) => {
      const result = validateProjectKey(key)
      expect(result.isValid).toBe(true)
      expect(result.error).toBeUndefined()
    })
  })

  describe('invalid keys', () => {
    test('rejects keys shorter than 3 letters', () => {
      const result = validateProjectKey('AB')
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('3 letters')
    })

    test('rejects empty string', () => {
      const result = validateProjectKey('')
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('3 letters')
    })

    test('rejects keys with numbers only', () => {
      const result = validateProjectKey('123')
      expect(result.isValid).toBe(false)
    })

    test('rejects keys with special characters only', () => {
      const result = validateProjectKey('!@#')
      expect(result.isValid).toBe(false)
    })
  })
})

// ================================
// suggestProjectKeyFromName Tests
// ================================

describe('suggestProjectKeyFromName', () => {
  describe('single word names', () => {
    test('uses first 3 letters for single word', () => {
      expect(suggestProjectKeyFromName('Oath')).toBe('OAT')
      expect(suggestProjectKeyFromName('Shippy')).toBe('SHI')
      expect(suggestProjectKeyFromName('GrowPilot')).toBe('GRO')
    })
  })

  describe('two word names', () => {
    test('uses first 3 letters of combined name', () => {
      expect(suggestProjectKeyFromName('My App')).toBe('MYA')
      expect(suggestProjectKeyFromName('Super School')).toBe('SUP')
    })
  })

  describe('three or more word names', () => {
    test('uses initials for 3+ words', () => {
      expect(suggestProjectKeyFromName('Earn A Slice')).toBe('EAS')
      expect(suggestProjectKeyFromName('The Quick Fox')).toBe('TQF')
      expect(suggestProjectKeyFromName('One Two Three Four')).toBe('OTT')
    })
  })

  describe('edge cases', () => {
    test('handles empty string', () => {
      expect(suggestProjectKeyFromName('')).toBe('XXX')
    })

    test('handles whitespace only', () => {
      expect(suggestProjectKeyFromName('   ')).toBe('XXX')
    })

    test('handles very short names', () => {
      expect(suggestProjectKeyFromName('AI')).toBe('AIX')
    })

    test('handles single letter', () => {
      expect(suggestProjectKeyFromName('X')).toBe('XXX')
    })

    test('handles diacritics', () => {
      expect(suggestProjectKeyFromName('Café')).toBe('CAF')
      expect(suggestProjectKeyFromName('naïve')).toBe('NAI')
    })

    test('removes numbers from names', () => {
      expect(suggestProjectKeyFromName('Web3 App')).toBe('WEB')
    })

    test('handles special characters', () => {
      expect(suggestProjectKeyFromName('My-App')).toBe('MYA')
      expect(suggestProjectKeyFromName('Hello_World')).toBe('HEL')
    })

    test('always returns uppercase', () => {
      expect(suggestProjectKeyFromName('lowercase')).toBe('LOW')
    })

    test('always returns exactly 3 characters', () => {
      expect(suggestProjectKeyFromName('A')).toHaveLength(3)
      expect(suggestProjectKeyFromName('AB')).toHaveLength(3)
      expect(suggestProjectKeyFromName('ABC')).toHaveLength(3)
      expect(suggestProjectKeyFromName('Very Long Name Here')).toHaveLength(3)
    })
  })
})
