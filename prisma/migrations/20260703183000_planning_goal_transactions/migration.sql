CREATE TABLE IF NOT EXISTS "PlanningGoalTransaction" (
  "goalId" TEXT NOT NULL,
  "transactionId" TEXT NOT NULL,
  "includeInternalTransfer" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlanningGoalTransaction_pkey" PRIMARY KEY ("goalId", "transactionId")
);

CREATE INDEX IF NOT EXISTS "PlanningGoalTransaction_transactionId_idx" ON "PlanningGoalTransaction"("transactionId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PlanningGoalTransaction_goalId_fkey') THEN
    ALTER TABLE "PlanningGoalTransaction" ADD CONSTRAINT "PlanningGoalTransaction_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "PlanningGoal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PlanningGoalTransaction_transactionId_fkey') THEN
    ALTER TABLE "PlanningGoalTransaction" ADD CONSTRAINT "PlanningGoalTransaction_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;