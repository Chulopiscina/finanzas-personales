ALTER TABLE "Transaction"
ADD COLUMN IF NOT EXISTS "isInternalTransfer" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "internalTransferGroupId" TEXT,
ADD COLUMN IF NOT EXISTS "internalTransferCounterAccountId" TEXT;

CREATE INDEX IF NOT EXISTS "Transaction_isInternalTransfer_idx" ON "Transaction"("isInternalTransfer");
CREATE INDEX IF NOT EXISTS "Transaction_internalTransferGroupId_idx" ON "Transaction"("internalTransferGroupId");
