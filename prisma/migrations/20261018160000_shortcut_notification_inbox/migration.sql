-- Additive only. Apply manually after reconciling the three existing history discrepancies.
CREATE TABLE "ShortcutDevice" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "lastUsedAt" TIMESTAMP(3),
  "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "windowCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShortcutDevice_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ShortcutDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ShortcutDevice_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ShortcutDevice_tokenHash_key" ON "ShortcutDevice"("tokenHash");
CREATE INDEX "ShortcutDevice_userId_createdAt_idx" ON "ShortcutDevice"("userId", "createdAt");

CREATE TABLE "BankNotification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "title" TEXT,
  "subtitle" TEXT,
  "body" TEXT NOT NULL,
  "sourceApp" TEXT,
  "rawPayload" JSONB NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "occurredAt" TIMESTAMP(3),
  "amount" DECIMAL(12,2),
  "currency" TEXT,
  "merchant" TEXT,
  "bankReference" TEXT,
  "categoryName" TEXT,
  "confidence" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'REVIEW',
  "transactionId" TEXT,
  CONSTRAINT "BankNotification_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BankNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BankNotification_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "ShortcutDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BankNotification_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "BankNotification_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "BankNotification_deviceId_eventId_key" ON "BankNotification"("deviceId", "eventId");
CREATE UNIQUE INDEX "BankNotification_transactionId_key" ON "BankNotification"("transactionId");
CREATE INDEX "BankNotification_userId_accountId_status_occurredAt_idx" ON "BankNotification"("userId", "accountId", "status", "occurredAt");
CREATE INDEX "BankNotification_userId_receivedAt_idx" ON "BankNotification"("userId", "receivedAt");
ALTER TABLE "ShortcutDevice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BankNotification" ENABLE ROW LEVEL SECURITY;
-- No browser/Data API policies. Only the trusted Prisma server role may access these tables.
