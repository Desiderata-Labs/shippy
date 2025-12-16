-- CreateTable
CREATE TABLE "github_connection" (
    "id" TEXT NOT NULL DEFAULT nanoid(),
    "projectId" TEXT NOT NULL,
    "installationId" INTEGER NOT NULL,
    "repoId" INTEGER NOT NULL,
    "repoFullName" TEXT NOT NULL,
    "autoApproveOnMerge" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "github_connection_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Links a Shippy bounty to a GitHub issue (created via /bounty command)
CREATE TABLE "github_issue_link" (
    "id" TEXT NOT NULL DEFAULT nanoid(),
    "bountyId" TEXT NOT NULL,
    "repoId" INTEGER NOT NULL,
    "issueNumber" INTEGER NOT NULL,
    "issueNodeId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "github_issue_link_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Links a Shippy submission to a GitHub PR (created when PR references bounty)
CREATE TABLE "github_pr_link" (
    "id" TEXT NOT NULL DEFAULT nanoid(),
    "submissionId" TEXT NOT NULL,
    "repoId" INTEGER NOT NULL,
    "prNumber" INTEGER NOT NULL,
    "prNodeId" TEXT NOT NULL,
    "prUrl" TEXT NOT NULL,
    "prMergedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "github_pr_link_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "github_connection_projectId_key" ON "github_connection"("projectId");

-- CreateIndex
CREATE INDEX "github_connection_installationId_idx" ON "github_connection"("installationId");

-- CreateIndex
CREATE INDEX "github_connection_repoId_idx" ON "github_connection"("repoId");

-- CreateIndex: One bounty per GitHub issue
CREATE UNIQUE INDEX "github_issue_link_bountyId_key" ON "github_issue_link"("bountyId");

-- CreateIndex: One bounty per repo+issue combo
CREATE UNIQUE INDEX "github_issue_link_repoId_issueNumber_key" ON "github_issue_link"("repoId", "issueNumber");

-- CreateIndex
CREATE INDEX "github_issue_link_repoId_idx" ON "github_issue_link"("repoId");

-- CreateIndex
CREATE UNIQUE INDEX "github_pr_link_submissionId_key" ON "github_pr_link"("submissionId");

-- CreateIndex
CREATE INDEX "github_pr_link_repoId_idx" ON "github_pr_link"("repoId");

-- AddForeignKey
ALTER TABLE "github_connection" ADD CONSTRAINT "github_connection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "github_issue_link" ADD CONSTRAINT "github_issue_link_bountyId_fkey" FOREIGN KEY ("bountyId") REFERENCES "bounty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "github_pr_link" ADD CONSTRAINT "github_pr_link_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
