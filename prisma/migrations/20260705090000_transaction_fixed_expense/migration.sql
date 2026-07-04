ALTER TABLE "Transaction" ADD COLUMN "isFixedExpense" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Transaction_isFixedExpense_idx" ON "Transaction"("isFixedExpense");