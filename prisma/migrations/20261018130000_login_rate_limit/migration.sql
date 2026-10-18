-- Additive only. No changes to users, sessions or financial data.
CREATE TABLE "LoginRateLimit" (
  "key" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 1,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LoginRateLimit_pkey" PRIMARY KEY ("key")
);
CREATE INDEX "LoginRateLimit_expiresAt_idx" ON "LoginRateLimit"("expiresAt");
