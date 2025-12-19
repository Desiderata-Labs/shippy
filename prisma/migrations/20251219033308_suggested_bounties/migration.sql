-- AlterTable
ALTER TABLE "bounty" ADD COLUMN     "suggestedById" TEXT;

-- CreateIndex
CREATE INDEX "bounty_suggestedById_idx" ON "bounty"("suggestedById");

-- AddForeignKey
ALTER TABLE "bounty" ADD CONSTRAINT "bounty_suggestedById_fkey" FOREIGN KEY ("suggestedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
