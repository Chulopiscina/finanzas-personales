CREATE TABLE IF NOT EXISTS "TransactionReimbursement" (
  "reimbursementId" TEXT NOT NULL,
  "expenseId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TransactionReimbursement_pkey" PRIMARY KEY ("reimbursementId", "expenseId")
);

CREATE INDEX IF NOT EXISTS "TransactionReimbursement_expenseId_idx" ON "TransactionReimbursement"("expenseId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TransactionReimbursement_reimbursementId_fkey') THEN
    ALTER TABLE "TransactionReimbursement" ADD CONSTRAINT "TransactionReimbursement_reimbursementId_fkey" FOREIGN KEY ("reimbursementId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TransactionReimbursement_expenseId_fkey') THEN
    ALTER TABLE "TransactionReimbursement" ADD CONSTRAINT "TransactionReimbursement_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;