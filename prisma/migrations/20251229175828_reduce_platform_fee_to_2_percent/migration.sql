-- AlterTable
ALTER TABLE "reward_pool" ALTER COLUMN "platformFeePercentage" SET DEFAULT 2;

-- Update existing projects to use the new 2% platform fee
UPDATE "reward_pool" SET "platformFeePercentage" = 2 WHERE "platformFeePercentage" = 10;
