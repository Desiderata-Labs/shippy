-- Multiple Reward Pool Types Migration (SHP-18)
-- Extends RewardPool to support multiple pools per project with different types:
-- PROFIT_SHARE (existing), FIXED_BUDGET, PER_BOUNTY

-- 1. Remove unique constraint on projectId to allow multiple pools per project
DROP INDEX IF EXISTS "reward_pool_projectId_key";

-- 2. Add new columns to reward_pool table
ALTER TABLE "reward_pool" ADD COLUMN "name" TEXT;
ALTER TABLE "reward_pool" ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "reward_pool" ADD COLUMN "poolType" TEXT NOT NULL DEFAULT 'PROFIT_SHARE';
ALTER TABLE "reward_pool" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "reward_pool" ADD COLUMN "budgetCents" BIGINT;
ALTER TABLE "reward_pool" ADD COLUMN "spentCents" BIGINT DEFAULT 0;

-- 3. Make PROFIT_SHARE fields nullable (for non-PROFIT_SHARE pools)
ALTER TABLE "reward_pool" ALTER COLUMN "poolPercentage" DROP NOT NULL;
ALTER TABLE "reward_pool" ALTER COLUMN "payoutFrequency" DROP NOT NULL;
ALTER TABLE "reward_pool" ALTER COLUMN "commitmentMonths" DROP NOT NULL;
ALTER TABLE "reward_pool" ALTER COLUMN "commitmentEndsAt" DROP NOT NULL;

-- 4. Add rewardPoolId to bounty (optional - uses project's default pool if null)
ALTER TABLE "bounty" ADD COLUMN "rewardPoolId" TEXT;
ALTER TABLE "bounty" ADD COLUMN "rewardCents" BIGINT;

-- 5. Backfill bounty.rewardPoolId from project's default pool
UPDATE "bounty" b SET "rewardPoolId" = (
  SELECT rp.id FROM "reward_pool" rp
  WHERE rp."projectId" = b."projectId" AND rp."isDefault" = true
  LIMIT 1
);

-- 6. Add rewardPoolId to payout (required - payouts are per-pool)
ALTER TABLE "payout" ADD COLUMN "rewardPoolId" TEXT;

-- 7. Backfill payout.rewardPoolId from project's default pool
UPDATE "payout" p SET "rewardPoolId" = (
  SELECT rp.id FROM "reward_pool" rp
  WHERE rp."projectId" = p."projectId" AND rp."isDefault" = true
  LIMIT 1
);

-- 8. Make payout.rewardPoolId required after backfill
ALTER TABLE "payout" ALTER COLUMN "rewardPoolId" SET NOT NULL;

-- 9. Add budget tracking to pool_expansion_event
ALTER TABLE "pool_expansion_event" ADD COLUMN "previousBudgetCents" BIGINT;
ALTER TABLE "pool_expansion_event" ADD COLUMN "newBudgetCents" BIGINT;

-- 10. Add indexes
CREATE INDEX "reward_pool_projectId_idx" ON "reward_pool"("projectId");
CREATE INDEX "reward_pool_projectId_isDefault_idx" ON "reward_pool"("projectId", "isDefault");
CREATE INDEX "bounty_rewardPoolId_idx" ON "bounty"("rewardPoolId");
CREATE INDEX "payout_rewardPoolId_idx" ON "payout"("rewardPoolId");

-- 11. Add foreign key constraints
ALTER TABLE "bounty" ADD CONSTRAINT "bounty_rewardPoolId_fkey"
  FOREIGN KEY ("rewardPoolId") REFERENCES "reward_pool"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payout" ADD CONSTRAINT "payout_rewardPoolId_fkey"
  FOREIGN KEY ("rewardPoolId") REFERENCES "reward_pool"("id") ON DELETE CASCADE ON UPDATE CASCADE;
