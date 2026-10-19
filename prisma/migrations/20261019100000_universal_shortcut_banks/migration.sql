-- Additive routing; existing devices remain single-account BBVA/advanced clients.
ALTER TABLE "ShortcutDevice" ADD COLUMN "isUniversal" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ShortcutPairing" ADD COLUMN "bankId" TEXT;
-- Only the provisional inbox may be unassigned. No financial table is modified.
ALTER TABLE "BankNotification" ALTER COLUMN "accountId" DROP NOT NULL;
ALTER TABLE "BankNotification" ADD COLUMN "bankId" TEXT;
CREATE TABLE "ShortcutBankBinding" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "bankId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShortcutBankBinding_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ShortcutBankBinding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ShortcutBankBinding_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "ShortcutDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ShortcutBankBinding_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ShortcutBankBinding_deviceId_bankId_key" ON "ShortcutBankBinding"("deviceId", "bankId");
CREATE INDEX "ShortcutBankBinding_userId_deviceId_idx" ON "ShortcutBankBinding"("userId", "deviceId");
CREATE INDEX "ShortcutBankBinding_accountId_idx" ON "ShortcutBankBinding"("accountId");
ALTER TABLE "ShortcutBankBinding" ENABLE ROW LEVEL SECURITY;
-- No Data API policies. Trusted Prisma server role only.
