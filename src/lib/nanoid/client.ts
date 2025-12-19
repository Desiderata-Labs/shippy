import { NANOID_ALPHABET, NANOID_LENGTH } from './shared'
import { customAlphabet } from 'nanoid'

/**
 * Generate a NanoID on the client side
 * Matches the server-side and PostgreSQL nanoid() function
 */
export const generateNanoId = customAlphabet(NANOID_ALPHABET, NANOID_LENGTH)

// Re-export shared utilities
export {
  createSlugWithId,
  extractNanoIdFromSlug,
  isValidNanoId,
  NANOID_ALPHABET,
  NANOID_LENGTH,
  NANOID_PATTERN,
} from './shared'
