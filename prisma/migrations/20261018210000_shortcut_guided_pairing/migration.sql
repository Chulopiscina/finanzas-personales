-- Additive only. Apply manually with authorization, never during a Vercel build.
ALTER TABLE "ShortcutDevice" ADD COLUMN "lastVerifiedAt" TIMESTAMP(3);

CREATE TABLE "ShortcutPairing" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "canceledAt" TIMESTAMP(3),
  "deviceId" TEXT,
  CONSTRAINT "ShortcutPairing_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ShortcutPairing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ShortcutPairing_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ShortcutPairing_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "ShortcutDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ShortcutPairing_codeHash_key" ON "ShortcutPairing"("codeHash");
CREATE UNIQUE INDEX "ShortcutPairing_deviceId_key" ON "ShortcutPairing"("deviceId");
CREATE INDEX "ShortcutPairing_userId_createdAt_idx" ON "ShortcutPairing"("userId", "createdAt");
ALTER TABLE "ShortcutPairing" ENABLE ROW LEVEL SECURITY;
-- No Data API policies: trusted Prisma server role only.
