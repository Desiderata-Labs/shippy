import { NANOID_ALPHABET, NANOID_LENGTH } from './shared'
import { customAlphabet } from 'nanoid'
import 'server-only'

/**
 * Generate a NanoID matching the PostgreSQL nanoid() function
 *
 * Uses the same alphabet and default length for consistency between
 * application-generated and database-generated IDs.
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
