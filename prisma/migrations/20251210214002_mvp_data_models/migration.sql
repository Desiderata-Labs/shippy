-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL DEFAULT nanoid(),
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL DEFAULT nanoid(),
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL DEFAULT nanoid(),
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMPTZ(3),
    "refreshTokenExpiresAt" TIMESTAMPTZ(3),
    "scope" TEXT,
    "idToken" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL DEFAULT nanoid(),
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project" (
    "id" TEXT NOT NULL DEFAULT nanoid(),
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "projectKey" VARCHAR(3) NOT NULL,
    "tagline" TEXT,
    "description" TEXT,
    "logoUrl" TEXT,
    "websiteUrl" TEXT,
    "discordUrl" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "payoutVisibility" TEXT NOT NULL DEFAULT 'PRIVATE',
    "founderId" TEXT NOT NULL,
    "nextBountyNumber" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward_pool" (
    "id" TEXT NOT NULL DEFAULT nanoid(),
    "projectId" TEXT NOT NULL,
    "poolPercentage" INTEGER NOT NULL,
    "poolCapacity" INTEGER NOT NULL DEFAULT 1000,
    "payoutFrequency" TEXT NOT NULL,
    "profitBasis" TEXT NOT NULL DEFAULT 'NET_PROFIT',
    "commitmentMonths" INTEGER NOT NULL DEFAULT 12,
    "commitmentEndsAt" TIMESTAMPTZ(3) NOT NULL,
    "platformFeePercentage" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "reward_pool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pool_expansion_event" (
    "id" TEXT NOT NULL DEFAULT nanoid(),
    "rewardPoolId" TEXT NOT NULL,
    "previousCapacity" INTEGER NOT NULL,
    "newCapacity" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "dilutionPercent" DECIMAL(5,2) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pool_expansion_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "label" (
    "id" TEXT NOT NULL DEFAULT nanoid(),
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "label_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bounty" (
    "id" TEXT NOT NULL DEFAULT nanoid(),
    "projectId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "claimMode" TEXT NOT NULL DEFAULT 'SINGLE',
    "claimExpiryDays" INTEGER NOT NULL DEFAULT 14,
    "maxClaims" INTEGER,
    "evidenceDescription" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "bounty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bounty_label" (
    "id" TEXT NOT NULL DEFAULT nanoid(),
    "bountyId" TEXT NOT NULL,
    "labelId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bounty_label_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bounty_event" (
    "id" TEXT NOT NULL DEFAULT nanoid(),
    "bountyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT,
    "changes" JSONB,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bounty_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bounty_claim" (
    "id" TEXT NOT NULL DEFAULT nanoid(),
    "bountyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "bounty_claim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submission" (
    "id" TEXT NOT NULL DEFAULT nanoid(),
    "bountyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "pointsAwarded" INTEGER,
    "approvedAt" TIMESTAMPTZ(3),
    "rejectedAt" TIMESTAMPTZ(3),
    "rejectionNote" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submission_event" (
    "id" TEXT NOT NULL DEFAULT nanoid(),
    "submissionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT,
    "changes" JSONB,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "submission_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submission_attachment" (
    "id" TEXT NOT NULL DEFAULT nanoid(),
    "submissionId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "contentType" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submission_attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payout" (
    "id" TEXT NOT NULL DEFAULT nanoid(),
    "projectId" TEXT NOT NULL,
    "periodStart" TIMESTAMPTZ(3) NOT NULL,
    "periodEnd" TIMESTAMPTZ(3) NOT NULL,
    "periodLabel" TEXT NOT NULL,
    "reportedProfitCents" INTEGER NOT NULL,
    "poolAmountCents" INTEGER NOT NULL,
    "platformFeeCents" INTEGER NOT NULL,
    "totalPointsAtPayout" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ANNOUNCED',
    "sentAt" TIMESTAMPTZ(3),
    "sentNote" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payout_recipient" (
    "id" TEXT NOT NULL DEFAULT nanoid(),
    "payoutId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pointsAtPayout" INTEGER NOT NULL,
    "sharePercent" DECIMAL(5,2) NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "paidAt" TIMESTAMPTZ(3),
    "paidNote" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "confirmedAt" TIMESTAMPTZ(3),
    "disputedAt" TIMESTAMPTZ(3),
    "confirmNote" TEXT,
    "disputeReason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payout_recipient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_username_key" ON "user"("username");

-- CreateIndex
CREATE INDEX "user_username_idx" ON "user"("username");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "project_slug_key" ON "project"("slug");

-- CreateIndex
CREATE INDEX "project_founderId_idx" ON "project"("founderId");

-- CreateIndex
CREATE INDEX "project_isPublic_idx" ON "project"("isPublic");

-- CreateIndex
CREATE UNIQUE INDEX "project_founderId_projectKey_key" ON "project"("founderId", "projectKey");

-- CreateIndex
CREATE UNIQUE INDEX "reward_pool_projectId_key" ON "reward_pool"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "label_projectId_name_key" ON "label"("projectId", "name");

-- CreateIndex
CREATE INDEX "label_projectId_idx" ON "label"("projectId");

-- CreateIndex
CREATE INDEX "bounty_projectId_idx" ON "bounty"("projectId");

-- CreateIndex
CREATE INDEX "bounty_status_idx" ON "bounty"("status");

-- CreateIndex
CREATE UNIQUE INDEX "bounty_projectId_number_key" ON "bounty"("projectId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "bounty_label_bountyId_labelId_key" ON "bounty_label"("bountyId", "labelId");

-- CreateIndex
CREATE INDEX "bounty_label_bountyId_idx" ON "bounty_label"("bountyId");

-- CreateIndex
CREATE INDEX "bounty_label_labelId_idx" ON "bounty_label"("labelId");

-- CreateIndex
CREATE INDEX "bounty_event_bountyId_idx" ON "bounty_event"("bountyId");

-- CreateIndex
CREATE INDEX "bounty_event_userId_idx" ON "bounty_event"("userId");

-- CreateIndex
CREATE INDEX "bounty_claim_bountyId_idx" ON "bounty_claim"("bountyId");

-- CreateIndex
CREATE INDEX "bounty_claim_userId_idx" ON "bounty_claim"("userId");

-- CreateIndex
CREATE INDEX "bounty_claim_status_idx" ON "bounty_claim"("status");

-- CreateIndex
CREATE INDEX "submission_bountyId_idx" ON "submission"("bountyId");

-- CreateIndex
CREATE INDEX "submission_userId_idx" ON "submission"("userId");

-- CreateIndex
CREATE INDEX "submission_status_idx" ON "submission"("status");

-- CreateIndex
CREATE INDEX "submission_event_submissionId_idx" ON "submission_event"("submissionId");

-- CreateIndex
CREATE INDEX "submission_event_userId_idx" ON "submission_event"("userId");

-- CreateIndex
CREATE INDEX "submission_attachment_submissionId_idx" ON "submission_attachment"("submissionId");

-- CreateIndex
CREATE INDEX "payout_projectId_idx" ON "payout"("projectId");

-- CreateIndex
CREATE INDEX "payout_status_idx" ON "payout"("status");

-- CreateIndex
CREATE INDEX "payout_recipient_payoutId_idx" ON "payout_recipient"("payoutId");

-- CreateIndex
CREATE INDEX "payout_recipient_userId_idx" ON "payout_recipient"("userId");

-- CreateIndex
CREATE INDEX "payout_recipient_status_idx" ON "payout_recipient"("status");

-- CreateIndex
CREATE UNIQUE INDEX "payout_recipient_payoutId_userId_key" ON "payout_recipient"("payoutId", "userId");

-- CreateIndex
CREATE INDEX "pool_expansion_event_rewardPoolId_idx" ON "pool_expansion_event"("rewardPoolId");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project" ADD CONSTRAINT "project_founderId_fkey" FOREIGN KEY ("founderId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_pool" ADD CONSTRAINT "reward_pool_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pool_expansion_event" ADD CONSTRAINT "pool_expansion_event_rewardPoolId_fkey" FOREIGN KEY ("rewardPoolId") REFERENCES "reward_pool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "label" ADD CONSTRAINT "label_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bounty" ADD CONSTRAINT "bounty_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bounty_label" ADD CONSTRAINT "bounty_label_bountyId_fkey" FOREIGN KEY ("bountyId") REFERENCES "bounty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bounty_label" ADD CONSTRAINT "bounty_label_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "label"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bounty_event" ADD CONSTRAINT "bounty_event_bountyId_fkey" FOREIGN KEY ("bountyId") REFERENCES "bounty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bounty_event" ADD CONSTRAINT "bounty_event_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bounty_claim" ADD CONSTRAINT "bounty_claim_bountyId_fkey" FOREIGN KEY ("bountyId") REFERENCES "bounty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bounty_claim" ADD CONSTRAINT "bounty_claim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission" ADD CONSTRAINT "submission_bountyId_fkey" FOREIGN KEY ("bountyId") REFERENCES "bounty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission" ADD CONSTRAINT "submission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_event" ADD CONSTRAINT "submission_event_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_event" ADD CONSTRAINT "submission_event_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_attachment" ADD CONSTRAINT "submission_attachment_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout" ADD CONSTRAINT "payout_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_recipient" ADD CONSTRAINT "payout_recipient_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "payout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_recipient" ADD CONSTRAINT "payout_recipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
