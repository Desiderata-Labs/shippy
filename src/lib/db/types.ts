/**
 * Database type enums for Shippy
 *
 * These enums are used in TypeScript code and correspond to string fields in the database.
 * This allows for type safety without relying on database enums.
 */

// ================================
// Stripe Connect Enums
// ================================

export enum StripeConnectAccountStatus {
  PENDING = 'PENDING', // Account created but onboarding not started
  ONBOARDING = 'ONBOARDING', // User is in the middle of onboarding
  ACTIVE = 'ACTIVE', // Account fully onboarded and can receive payouts
  RESTRICTED = 'RESTRICTED', // Account has restrictions (needs attention)
  DISABLED = 'DISABLED', // Account disabled (fraud, TOS violation, etc.)
}

export enum PayoutPaymentStatus {
  PENDING = 'PENDING', // Awaiting founder payment
  PROCESSING = 'PROCESSING', // Checkout session created, awaiting completion
  PAID = 'PAID', // Founder payment received
  FAILED = 'FAILED', // Payment failed
  REFUNDED = 'REFUNDED', // Payment was refunded
}

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
  SUGGESTED = 'SUGGESTED', // Suggested by contributor, awaiting founder approval
  BACKLOG = 'BACKLOG', // No points assigned yet, not claimable
  OPEN = 'OPEN',
  CLAIMED = 'CLAIMED', // All claim slots filled (for SINGLE mode)
  COMPLETED = 'COMPLETED', // Bounty fully completed
  CLOSED = 'CLOSED', // Manually closed by founder
}

export enum BountyClaimMode {
  SINGLE = 'SINGLE', // Exclusive: One contributor claims, others locked out
  COMPETITIVE = 'COMPETITIVE', // Competitive: Anyone can claim, first approved wins
  MULTIPLE = 'MULTIPLE', // Multiple: Anyone can complete, all approved get points
  PERFORMANCE = 'PERFORMANCE', // Performance: Points per verified result (referrals, leads, etc.)
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
  EXPIRED = 'EXPIRED', // Claim expired due to time limit
  RELEASED = 'RELEASED', // User voluntarily released their claim
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

export enum PayoutVisibility {
  PRIVATE = 'PRIVATE', // Only show confirmation status, hide amounts
  PUBLIC = 'PUBLIC', // Show all amounts publicly
}

// ================================
// Notification Enums
// ================================

export enum NotificationType {
  // Comments
  BOUNTY_COMMENT = 'BOUNTY_COMMENT',
  SUBMISSION_COMMENT = 'SUBMISSION_COMMENT',

  // Mentions (when @mentioned in a comment)
  BOUNTY_MENTION = 'BOUNTY_MENTION',
  SUBMISSION_MENTION = 'SUBMISSION_MENTION',

  // Bounty suggestions
  BOUNTY_SUGGESTED = 'BOUNTY_SUGGESTED', // Contributor suggested a bounty
  BOUNTY_SUGGESTION_APPROVED = 'BOUNTY_SUGGESTION_APPROVED', // Founder approved suggestion
  BOUNTY_SUGGESTION_REJECTED = 'BOUNTY_SUGGESTION_REJECTED', // Founder rejected suggestion

  // Submissions
  SUBMISSION_CREATED = 'SUBMISSION_CREATED',
  SUBMISSION_APPROVED = 'SUBMISSION_APPROVED',
  SUBMISSION_REJECTED = 'SUBMISSION_REJECTED',
  SUBMISSION_NEEDS_INFO = 'SUBMISSION_NEEDS_INFO',
  SUBMISSION_PR_MERGED = 'SUBMISSION_PR_MERGED', // PR merged, needs manual review

  // Claims
  BOUNTY_CLAIMED = 'BOUNTY_CLAIMED',
  CLAIM_EXPIRING = 'CLAIM_EXPIRING', // Requires scheduled job
  CLAIM_EXPIRED = 'CLAIM_EXPIRED',

  // Payouts
  PAYOUT_ANNOUNCED = 'PAYOUT_ANNOUNCED',
  PAYOUT_SENT = 'PAYOUT_SENT',
  PAYOUT_CONFIRMED = 'PAYOUT_CONFIRMED',
  PAYOUT_DISPUTED = 'PAYOUT_DISPUTED',

  // Stripe payouts (contributor receives transfer)
  PAYOUT_TRANSFER_SENT = 'PAYOUT_TRANSFER_SENT', // Transfer sent to contributor's Stripe account
  PAYOUT_TRANSFER_PENDING = 'PAYOUT_TRANSFER_PENDING', // Founder paid but contributor needs Stripe Connect

  // Payment status (sent to founder)
  PAYOUT_PAYMENT_SUCCEEDED = 'PAYOUT_PAYMENT_SUCCEEDED', // ACH payment cleared (sent to founder)
  PAYOUT_PAYMENT_FAILED = 'PAYOUT_PAYMENT_FAILED', // ACH or card payment failed (sent to founder)
}

export enum NotificationReferenceType {
  BOUNTY = 'BOUNTY',
  SUBMISSION = 'SUBMISSION',
  PAYOUT = 'PAYOUT',
}

// ================================
// Attachment Enums
// ================================

export enum AttachmentReferenceType {
  BOUNTY = 'BOUNTY',
  SUBMISSION = 'SUBMISSION',
  // Pending types for attachments uploaded before entity is created
  PENDING_BOUNTY = 'PENDING_BOUNTY',
  PENDING_SUBMISSION = 'PENDING_SUBMISSION',
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
 * Current version of the platform's standard contributor agreement template
 * Increment this when making material changes to legal/contributor-agreement-template.md
 */
export const CONTRIBUTOR_AGREEMENT_TEMPLATE_VERSION = 1

/**
 * Default pool expiration notice period (in days)
 */
export const DEFAULT_POOL_EXPIRATION_NOTICE_DAYS = 30

/**
 * Default governing law for contributor agreements
 */
export const DEFAULT_GOVERNING_LAW = 'the Commonwealth of Pennsylvania'

/**
 * Default forum selection for contributor agreements
 */
export const DEFAULT_FORUM_SELECTION =
  'the state or federal courts located in Allegheny County, Pennsylvania'

/**
 * Default platform fee percentage (of pool)
 */
export const DEFAULT_PLATFORM_FEE_PERCENTAGE = 2

/**
 * Verification window in days for payout confirmation
 */
export const PAYOUT_VERIFICATION_WINDOW_DAYS = 30
