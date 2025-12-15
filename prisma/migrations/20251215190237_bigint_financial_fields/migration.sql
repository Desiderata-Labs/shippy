-- AlterTable
ALTER TABLE "payout" ALTER COLUMN "reportedProfitCents" SET DATA TYPE BIGINT,
ALTER COLUMN "poolAmountCents" SET DATA TYPE BIGINT,
ALTER COLUMN "platformFeeCents" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "payout_recipient" ALTER COLUMN "amountCents" SET DATA TYPE BIGINT;
