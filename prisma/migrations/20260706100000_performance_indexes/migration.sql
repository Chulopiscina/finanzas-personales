CREATE INDEX IF NOT EXISTS "Transaction_userId_accountId_date_idx" ON "Transaction"("userId", "accountId", "date");
CREATE INDEX IF NOT EXISTS "Transaction_userId_categoryId_date_idx" ON "Transaction"("userId", "categoryId", "date");
CREATE INDEX IF NOT EXISTS "Transaction_userId_importHistoryId_date_idx" ON "Transaction"("userId", "importHistoryId", "date");
CREATE INDEX IF NOT EXISTS "Transaction_userId_type_date_idx" ON "Transaction"("userId", "type", "date");
CREATE INDEX IF NOT EXISTS "Transaction_userId_isInternalTransfer_date_idx" ON "Transaction"("userId", "isInternalTransfer", "date");
CREATE INDEX IF NOT EXISTS "Transaction_userId_isFixedExpense_date_idx" ON "Transaction"("userId", "isFixedExpense", "date");
CREATE INDEX IF NOT EXISTS "PlanningGoalTransaction_goalId_createdAt_idx" ON "PlanningGoalTransaction"("goalId", "createdAt");
CREATE INDEX IF NOT EXISTS "TransactionReimbursement_reimbursementId_createdAt_idx" ON "TransactionReimbursement"("reimbursementId", "createdAt");