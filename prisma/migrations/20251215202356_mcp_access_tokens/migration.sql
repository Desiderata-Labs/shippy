-- CreateTable
CREATE TABLE "mcp_access_token" (
    "id" TEXT NOT NULL DEFAULT nanoid(),
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMPTZ(3),
    "expiresAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mcp_access_token_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mcp_access_token_tokenHash_key" ON "mcp_access_token"("tokenHash");

-- CreateIndex
CREATE INDEX "mcp_access_token_userId_idx" ON "mcp_access_token"("userId");

-- AddForeignKey
ALTER TABLE "mcp_access_token" ADD CONSTRAINT "mcp_access_token_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
