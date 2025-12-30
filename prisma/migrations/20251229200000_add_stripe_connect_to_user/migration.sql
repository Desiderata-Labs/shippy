-- Stripe Integration
-- This migration adds all Stripe-related infrastructure for:
-- 1. User: Stripe Connect accounts (for receiving payouts)
-- 2. Payout: Payment tracking (for founder payments via Checkout)
-- 3. StripeEvent: Audit log for all webhook events

-- ================================
-- User: Stripe Connect fields
-- ================================
ALTER TABLE "user" ADD COLUMN "stripeConnectAccountId" TEXT;
ALTER TABLE "user" ADD COLUMN "stripeConnectAccountStatus" TEXT;
ALTER TABLE "user" ADD COLUMN "stripeConnectOnboardedAt" TIMESTAMPTZ(3);

-- Unique constraint for Stripe account ID
CREATE UNIQUE INDEX "user_stripeConnectAccountId_key" ON "user"("stripeConnectAccountId");

-- ================================
-- Payout: Distributed amount tracking
-- ================================
-- distributedAmountCents = actual amount going to contributors (after Stripe fees)
-- This is (98% of pool × utilization) minus Stripe processing fees
ALTER TABLE "payout" ADD COLUMN "distributedAmountCents" BIGINT NOT NULL DEFAULT 0;

-- ================================
-- Payout: Founder payment tracking
-- ================================
-- Fee model:
-- - Shippy takes 2% of the FULL pool (platformFeeCents) regardless of utilization
-- - Contributors get 98% of pool × utilization (potentialContributorCents)
-- - Founder pays: platformFeeCents + potentialContributorCents
-- - Stripe fee is absorbed by contributors (deducted from their share)
ALTER TABLE "payout" ADD COLUMN "stripeFeeCents" BIGINT;
ALTER TABLE "payout" ADD COLUMN "founderTotalCents" BIGINT;
ALTER TABLE "payout" ADD COLUMN "paymentStatus" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "payout" ADD COLUMN "stripeSessionId" TEXT;
ALTER TABLE "payout" ADD COLUMN "stripePaymentIntent" TEXT;
ALTER TABLE "payout" ADD COLUMN "paidAt" TIMESTAMPTZ(3);

-- Unique constraints for Stripe IDs
CREATE UNIQUE INDEX "payout_stripeSessionId_key" ON "payout"("stripeSessionId");
CREATE UNIQUE INDEX "payout_stripePaymentIntent_key" ON "payout"("stripePaymentIntent");

-- Index for payment status queries
CREATE INDEX "payout_paymentStatus_idx" ON "payout"("paymentStatus");

-- ================================
-- StripeEvent: Webhook audit log
-- ================================
-- Stores all Stripe webhook events for debugging and replay
CREATE TABLE "stripe_event" (
    "id" TEXT NOT NULL DEFAULT nanoid(),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stripeEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventJson" JSONB NOT NULL,
    "stripeAccountId" TEXT,
    "stripeSessionId" TEXT,
    "stripePaymentIntent" TEXT,
    "userId" TEXT,
    "payoutId" TEXT,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMPTZ(3),
    "error" TEXT,

    CONSTRAINT "stripe_event_pkey" PRIMARY KEY ("id")
);

-- Unique constraint on Stripe event ID (for idempotency)
CREATE UNIQUE INDEX "stripe_event_stripeEventId_key" ON "stripe_event"("stripeEventId");

-- Indexes for common queries
CREATE INDEX "stripe_event_stripeEventId_idx" ON "stripe_event"("stripeEventId");
CREATE INDEX "stripe_event_eventType_idx" ON "stripe_event"("eventType");
CREATE INDEX "stripe_event_stripeAccountId_idx" ON "stripe_event"("stripeAccountId");
CREATE INDEX "stripe_event_userId_idx" ON "stripe_event"("userId");
CREATE INDEX "stripe_event_payoutId_idx" ON "stripe_event"("payoutId");
CREATE INDEX "stripe_event_processed_idx" ON "stripe_event"("processed");
CREATE INDEX "stripe_event_createdAt_idx" ON "stripe_event"("createdAt");

-- ================================
-- PayoutRecipient: Stripe transfer tracking
-- ================================
ALTER TABLE "payout_recipient" ADD COLUMN "stripeTransferId" TEXT;

-- Index for transfer ID (NOT unique - carry-forward aggregates multiple recipients into one transfer)
CREATE INDEX "payout_recipient_stripeTransferId_idx" ON "payout_recipient"("stripeTransferId");

-- ================================
-- Remove legacy manual payout fields (replaced by Stripe payment tracking)
-- ================================

-- Payout: Remove manual status fields (now derived from paymentStatus + recipient.paidAt)
ALTER TABLE "payout" DROP COLUMN IF EXISTS "status";
ALTER TABLE "payout" DROP COLUMN IF EXISTS "sentAt";
ALTER TABLE "payout" DROP COLUMN IF EXISTS "sentNote";

-- Drop old index on status
DROP INDEX IF EXISTS "payout_status_idx";

-- PayoutRecipient: Remove manual confirmation fields (Stripe transfers auto-verify payment)
ALTER TABLE "payout_recipient" DROP COLUMN IF EXISTS "status";
ALTER TABLE "payout_recipient" DROP COLUMN IF EXISTS "confirmedAt";
ALTER TABLE "payout_recipient" DROP COLUMN IF EXISTS "disputedAt";
ALTER TABLE "payout_recipient" DROP COLUMN IF EXISTS "confirmNote";
ALTER TABLE "payout_recipient" DROP COLUMN IF EXISTS "disputeReason";
ALTER TABLE "payout_recipient" DROP COLUMN IF EXISTS "paidNote";

-- Drop old index on recipient status
DROP INDEX IF EXISTS "payout_recipient_status_idx";
