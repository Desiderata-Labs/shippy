/**
 * Database type enums for Shippy
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
  BACKLOG = 'BACKLOG', // No points assigned yet, not claimable
  OPEN = 'OPEN',
  CLAIMED = 'CLAIMED', // All claim slots filled (for SINGLE mode)
  COMPLETED = 'COMPLETED', // Bounty fully completed
  CLOSED = 'CLOSED', // Manually closed by founder
}

export enum BountyClaimMode {
  SINGLE = 'SINGLE', // Exclusive: One contributor claims, others locked out
  MULTIPLE = 'MULTIPLE', // Competitive: Anyone can claim, first approved wins
}

/**
 * Generate a random hex color for labels (like GitHub)
 */
export function generateRandomLabelColor(): string {
  // Use pleasant, saturated colors that work well on both light and dark backgrounds
  const hue = Math.floor(Math.random() * 360)
  const saturation = 60 + Math.floor(Math.random() * 20) // 60-80%
  const lightness = 45 + Math.floor(Math.random() * 15) // 45-60%
  return hslToHex(hue, saturation, lightness)
}

/**
 * Convert HSL to hex color
 */
function hslToHex(h: number, s: number, l: number): string {
  s /= 100
  l /= 100
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

/**
 * Validate hex color format
 */
export function isValidHexColor(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(color)
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
  WITHDRAWN = 'WITHDRAWN', // Contributor released their claim
}

export enum SubmissionEventType {
  COMMENT = 'COMMENT', // Regular user comment
  EDIT = 'EDIT', // Submission was edited
  STATUS_CHANGE = 'STATUS_CHANGE', // Status transition (approve, reject, request info)
}

// ================================
// Bounty Event Enums
// ================================

export enum BountyEventType {
  COMMENT = 'COMMENT', // Regular user comment
  EDIT = 'EDIT', // Bounty was edited
  STATUS_CHANGE = 'STATUS_CHANGE', // Status transition (open, claimed, completed, closed)
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
// Notification Enums
// ================================

export enum NotificationType {
  BOUNTY_COMMENT = 'BOUNTY_COMMENT',
  SUBMISSION_COMMENT = 'SUBMISSION_COMMENT',
  // Future: SUBMISSION_APPROVED, SUBMISSION_REJECTED, PAYOUT_SENT, etc.
}

export enum NotificationReferenceType {
  BOUNTY = 'BOUNTY',
  SUBMISSION = 'SUBMISSION',
  // Future: PROJECT, PAYOUT, etc.
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
  FIVE_YEARS = '60',
  TEN_YEARS = '120',
  FOREVER = '9999',
}

/**
 * Commitment period options as numbers (for database storage)
 */
export const COMMITMENT_PERIODS = [6, 12, 24, 36, 60, 120, 9999] as const
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
