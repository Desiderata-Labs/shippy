-- AlterTable
ALTER TABLE "project" ADD COLUMN     "contributorTermsCustom" TEXT,
ADD COLUMN     "contributorTermsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "contributorTermsGoverningLaw" TEXT,
ADD COLUMN     "contributorTermsVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "projectOwnerAuthorizedRepresentativeName" TEXT,
ADD COLUMN     "projectOwnerAuthorizedRepresentativeTitle" TEXT,
ADD COLUMN     "projectOwnerContactEmail" TEXT,
ADD COLUMN     "projectOwnerLegalName" TEXT;

-- CreateTable
CREATE TABLE "contributor_agreement" (
    "id" TEXT NOT NULL DEFAULT nanoid(),
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "standardTemplateVersion" INTEGER NOT NULL,
    "projectTermsVersion" INTEGER NOT NULL,
    "acceptedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "termsSnapshot" JSONB NOT NULL,
    "termsHash" TEXT NOT NULL,

    CONSTRAINT "contributor_agreement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contributor_agreement_projectId_idx" ON "contributor_agreement"("projectId");

-- CreateIndex
CREATE INDEX "contributor_agreement_userId_idx" ON "contributor_agreement"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "contributor_agreement_projectId_userId_standardTemplateVers_key" ON "contributor_agreement"("projectId", "userId", "standardTemplateVersion", "projectTermsVersion");

-- AddForeignKey
ALTER TABLE "contributor_agreement" ADD CONSTRAINT "contributor_agreement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributor_agreement" ADD CONSTRAINT "contributor_agreement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
