-- CreateTable
CREATE TABLE "notification" (
    "id" TEXT NOT NULL DEFAULT nanoid(),
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "referenceType" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "readAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "thread_subscription" (
    "id" TEXT NOT NULL DEFAULT nanoid(),
    "userId" TEXT NOT NULL,
    "referenceType" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "muted" BOOLEAN NOT NULL DEFAULT false,
    "watching" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "thread_subscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_userId_readAt_idx" ON "notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "notification_userId_createdAt_idx" ON "notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "notification_referenceType_referenceId_idx" ON "notification"("referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "thread_subscription_userId_idx" ON "thread_subscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "thread_subscription_userId_referenceType_referenceId_key" ON "thread_subscription"("userId", "referenceType", "referenceId");

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thread_subscription" ADD CONSTRAINT "thread_subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
