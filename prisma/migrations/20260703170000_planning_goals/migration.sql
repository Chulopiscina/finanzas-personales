DO $$ BEGIN
  CREATE TYPE "PlanningGoalType" AS ENUM ('FIXED_EXPENSE', 'VARIABLE_EXPENSE', 'SAVINGS', 'INVESTMENT', 'DEBT', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PlanningPeriod" AS ENUM ('MONTHLY', 'ANNUAL', 'CUSTOM');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PlanningStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "PlanningGoal" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "accountId" TEXT,
  "name" TEXT NOT NULL,
  "type" "PlanningGoalType" NOT NULL,
  "targetAmount" DECIMAL(12,2) NOT NULL,
  "period" "PlanningPeriod" NOT NULL DEFAULT 'MONTHLY',
  "periodStart" TIMESTAMP(3),
  "periodEnd" TIMESTAMP(3),
  "color" TEXT,
  "icon" TEXT,
  "status" "PlanningStatus" NOT NULL DEFAULT 'ACTIVE',
  "showInDashboard" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlanningGoal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PlanningGoalCategory" (
  "goalId" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  CONSTRAINT "PlanningGoalCategory_pkey" PRIMARY KEY ("goalId", "categoryId")
);

CREATE INDEX IF NOT EXISTS "PlanningGoal_userId_status_idx" ON "PlanningGoal"("userId", "status");
CREATE INDEX IF NOT EXISTS "PlanningGoal_userId_showInDashboard_idx" ON "PlanningGoal"("userId", "showInDashboard");
CREATE INDEX IF NOT EXISTS "PlanningGoal_accountId_idx" ON "PlanningGoal"("accountId");
CREATE INDEX IF NOT EXISTS "PlanningGoalCategory_categoryId_idx" ON "PlanningGoalCategory"("categoryId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PlanningGoal_userId_fkey') THEN
    ALTER TABLE "PlanningGoal" ADD CONSTRAINT "PlanningGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PlanningGoal_accountId_fkey') THEN
    ALTER TABLE "PlanningGoal" ADD CONSTRAINT "PlanningGoal_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PlanningGoalCategory_goalId_fkey') THEN
    ALTER TABLE "PlanningGoalCategory" ADD CONSTRAINT "PlanningGoalCategory_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "PlanningGoal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PlanningGoalCategory_categoryId_fkey') THEN
    ALTER TABLE "PlanningGoalCategory" ADD CONSTRAINT "PlanningGoalCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
