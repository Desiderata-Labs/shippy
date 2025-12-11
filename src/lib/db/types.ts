/**
 * Database type enums for Earn A Slice
 *
 * These enums are used in TypeScript code and correspond to string fields in the database.
 * This allows for type safety without relying on database enums.
 */

// ================================
// Reward Pool Enums
// ================================

export enum PayoutFrequency {
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
}

export enum ProfitBasis {
  NET_PROFIT = 'NET_PROFIT',
  GROSS_REVENUE = 'GROSS_REVENUE',
}

// ================================
// Bounty Enums
// ================================

export enum BountyStatus {
  OPEN = 'OPEN',
  CLAIMED = 'CLAIMED', // All claim slots filled (for SINGLE mode)
  COMPLETED = 'COMPLETED', // Bounty fully completed
  CLOSED = 'CLOSED', // Manually closed by founder
}

export enum BountyClaimMode {
  SINGLE = 'SINGLE', // One contributor at a time
  MULTIPLE = 'MULTIPLE', // Multiple contributors can work on it
}

export enum BountyTag {
  GROWTH = 'GROWTH',
  SALES = 'SALES',
  CONTENT = 'CONTENT',
  DESIGN = 'DESIGN',
  DEV = 'DEV',
}

// ================================
// Claim Enums
// ================================

export enum ClaimStatus {
  ACTIVE = 'ACTIVE', // Currently working on it
  EXPIRED = 'EXPIRED', // Claim expired without submission
  SUBMITTED = 'SUBMITTED', // Submission created
  COMPLETED = 'COMPLETED', // Submission approved
}

// ================================
// Submission Enums
// ================================

export enum SubmissionStatus {
  DRAFT = 'DRAFT', // Contributor still working on it
  PENDING = 'PENDING', // Submitted, awaiting review
  NEEDS_INFO = 'NEEDS_INFO', // Founder requested more info
  APPROVED = 'APPROVED', // Points awarded
  REJECTED = 'REJECTED', // Not accepted
}

export enum SubmissionEventType {
  COMMENT = 'COMMENT', // Regular user comment
  STATUS_CHANGE = 'STATUS_CHANGE', // Status transition (approve, reject, request info)
}

// ================================
// Payout Enums
// ================================

export enum PayoutStatus {
  ANNOUNCED = 'ANNOUNCED', // Payout announced, split calculated
  SENT = 'SENT', // Founder marked as sent
  COMPLETED = 'COMPLETED', // All recipients confirmed/unconfirmed
}

export enum PayoutRecipientStatus {
  PENDING = 'PENDING', // Awaiting confirmation
  CONFIRMED = 'CONFIRMED', // Contributor confirmed receipt
  DISPUTED = 'DISPUTED', // Contributor says not received
  UNCONFIRMED = 'UNCONFIRMED', // No response after 30 days
}

export enum PayoutVisibility {
  PRIVATE = 'PRIVATE', // Only show confirmation status, hide amounts
  PUBLIC = 'PUBLIC', // Show all amounts publicly
}

// ================================
// Helper Types
// ================================

/**
 * Commitment period options (in months)
 * Using string values for form compatibility
 */
export enum CommitmentMonths {
  SIX_MONTHS = '6',
  ONE_YEAR = '12',
  TWO_YEARS = '24',
  THREE_YEARS = '36',
}

/**
 * Commitment period options as numbers (for database storage)
 */
export const COMMITMENT_PERIODS = [6, 12, 24, 36] as const
export type CommitmentPeriod = (typeof COMMITMENT_PERIODS)[number]

/**
 * Default claim expiry in days
 */
export const DEFAULT_CLAIM_EXPIRY_DAYS = 14

/**
 * Default platform fee percentage (of pool)
 */
export const DEFAULT_PLATFORM_FEE_PERCENTAGE = 10

/**
 * Verification window in days for payout confirmation
 */
export const PAYOUT_VERIFICATION_WINDOW_DAYS = 30
