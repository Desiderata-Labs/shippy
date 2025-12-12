import { NANOID_PATTERN } from './shared'
import { z } from 'zod'

/**
 * Zod schema for validating NanoIDs
 *
 * Use this instead of z.string().uuid() for ID validation
 */
export const nanoidSchema = z
  .string()
  .regex(NANOID_PATTERN, 'Invalid ID format')

/**
 * Convenience function to create a nanoid field in a Zod object schema
 */
export const nanoId = () => nanoidSchema
