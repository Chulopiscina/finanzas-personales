DO $$ BEGIN
  CREATE TYPE "BudgetBlockType" AS ENUM ('FIXED', 'VARIABLE', 'EXTRA', 'SAVINGS');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "MonthlyBudget" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "accountId" TEXT,
  "month" TIMESTAMP(3) NOT NULL,
  "expectedIncome" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "fixedLimit" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "variableLimit" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "extraLimit" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "savingsGoal" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MonthlyBudget_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MonthlyBudgetCategory" (
  "budgetId" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "block" "BudgetBlockType" NOT NULL,
  CONSTRAINT "MonthlyBudgetCategory_pkey" PRIMARY KEY ("budgetId", "categoryId")
);

CREATE INDEX IF NOT EXISTS "MonthlyBudget_userId_month_idx" ON "MonthlyBudget"("userId", "month");
CREATE INDEX IF NOT EXISTS "MonthlyBudget_accountId_idx" ON "MonthlyBudget"("accountId");
CREATE INDEX IF NOT EXISTS "MonthlyBudgetCategory_categoryId_idx" ON "MonthlyBudgetCategory"("categoryId");
CREATE INDEX IF NOT EXISTS "MonthlyBudgetCategory_block_idx" ON "MonthlyBudgetCategory"("block");

DO $$ BEGIN
  ALTER TABLE "MonthlyBudget" ADD CONSTRAINT "MonthlyBudget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "MonthlyBudget" ADD CONSTRAINT "MonthlyBudget_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "MonthlyBudgetCategory" ADD CONSTRAINT "MonthlyBudgetCategory_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "MonthlyBudget"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "MonthlyBudgetCategory" ADD CONSTRAINT "MonthlyBudgetCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
