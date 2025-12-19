/*
  Warnings:

  - You are about to drop the `submission_attachment` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "submission_attachment" DROP CONSTRAINT "submission_attachment_submissionId_fkey";

-- DropTable
DROP TABLE "submission_attachment";

-- CreateTable
CREATE TABLE "attachment" (
    "id" TEXT NOT NULL DEFAULT nanoid(),
    "referenceType" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "contentType" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attachment_referenceType_referenceId_idx" ON "attachment"("referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "attachment_userId_idx" ON "attachment"("userId");

-- AddForeignKey
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
