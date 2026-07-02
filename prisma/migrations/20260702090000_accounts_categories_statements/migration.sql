-- Add account and category management without deleting existing data.
DO $$
BEGIN
  CREATE TYPE "AccountType" AS ENUM ('BANK', 'SAVINGS', 'CARD', 'CASH', 'INVESTMENT', 'DEBT', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "CategoryType" AS ENUM ('INCOME', 'EXPENSE', 'SAVINGS', 'TRANSFER', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE "ImportStatus" ADD VALUE IF NOT EXISTS 'PENDING';

CREATE TABLE IF NOT EXISTS "Account" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "AccountType" NOT NULL DEFAULT 'BANK',
  "initialBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'EUR',
  "color" TEXT,
  "icon" TEXT,
  "isArchived" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

INSERT INTO "Account" ("id", "userId", "name", "type", "initialBalance", "currency", "color", "icon", "isArchived", "createdAt", "updatedAt")
SELECT 'acct_' || md5("id"), "id", 'Cuenta principal', 'BANK', 0, 'EUR', '#14b8a6', 'landmark', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User"
ON CONFLICT DO NOTHING;

ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "userId" TEXT;
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "type" "CategoryType" NOT NULL DEFAULT 'OTHER';
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "isArchived" BOOLEAN NOT NULL DEFAULT false;

DROP INDEX IF EXISTS "Category_name_key";

UPDATE "Category"
SET "name" = U&'Alimentaci\00F3n'
WHERE "name" IN (U&'Alimentaci\00C3\00B3n', U&'Alimentaci\00C3\0192\00C2\00B3n', 'Alimentacion');
UPDATE "Category"
SET "name" = U&'N\00F3mina'
WHERE "name" IN (U&'N\00C3\00B3mina', U&'N\00C3\0192\00C2\00B3mina', 'Nomina');
UPDATE "Category" SET "type" = 'INCOME' WHERE "name" = U&'N\00F3mina';
UPDATE "Category" SET "type" = 'TRANSFER' WHERE "name" = 'Transferencias';
UPDATE "Category" SET "type" = 'EXPENSE' WHERE "name" NOT IN (U&'N\00F3mina', 'Transferencias');

ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "accountId" TEXT;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "cleanDescription" TEXT;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "rawDescription" TEXT;
UPDATE "Transaction" t
SET "accountId" = 'acct_' || md5(t."userId"),
    "rawDescription" = COALESCE(t."rawDescription", t."concept")
WHERE "accountId" IS NULL;
ALTER TABLE "Transaction" ALTER COLUMN "accountId" SET NOT NULL;

ALTER TABLE "ImportHistory" ADD COLUMN IF NOT EXISTS "accountId" TEXT;
ALTER TABLE "ImportHistory" ADD COLUMN IF NOT EXISTS "incomeTotal" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "ImportHistory" ADD COLUMN IF NOT EXISTS "expenseTotal" DECIMAL(12,2) NOT NULL DEFAULT 0;
UPDATE "ImportHistory" i SET "accountId" = 'acct_' || md5(i."userId") WHERE "accountId" IS NULL;
ALTER TABLE "ImportHistory" ALTER COLUMN "accountId" SET NOT NULL;

UPDATE "ImportHistory" i
SET "incomeTotal" = COALESCE((
  SELECT SUM(CASE WHEN t."type" = 'INCOME' THEN ABS(t."amount") ELSE 0 END)
  FROM "Transaction" t WHERE t."importHistoryId" = i."id"
), 0),
"expenseTotal" = COALESCE((
  SELECT SUM(CASE WHEN t."type" = 'EXPENSE' THEN ABS(t."amount") ELSE 0 END)
  FROM "Transaction" t WHERE t."importHistoryId" = i."id"
), 0);

DROP INDEX IF EXISTS "Transaction_userId_sourceHash_key";

CREATE UNIQUE INDEX IF NOT EXISTS "Account_userId_name_key" ON "Account"("userId", "name");
CREATE INDEX IF NOT EXISTS "Account_userId_isArchived_idx" ON "Account"("userId", "isArchived");
CREATE INDEX IF NOT EXISTS "Category_userId_isArchived_idx" ON "Category"("userId", "isArchived");
CREATE UNIQUE INDEX IF NOT EXISTS "Category_userId_name_key" ON "Category"("userId", "name");
CREATE INDEX IF NOT EXISTS "Transaction_accountId_date_idx" ON "Transaction"("accountId", "date");
CREATE INDEX IF NOT EXISTS "Transaction_importHistoryId_idx" ON "Transaction"("importHistoryId");
CREATE UNIQUE INDEX IF NOT EXISTS "Transaction_userId_accountId_sourceHash_key" ON "Transaction"("userId", "accountId", "sourceHash");
CREATE INDEX IF NOT EXISTS "ImportHistory_accountId_createdAt_idx" ON "ImportHistory"("accountId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Account_userId_fkey') THEN
    ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Category_userId_fkey') THEN
    ALTER TABLE "Category" ADD CONSTRAINT "Category_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Transaction_accountId_fkey') THEN
    ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ImportHistory_accountId_fkey') THEN
    ALTER TABLE "ImportHistory" ADD CONSTRAINT "ImportHistory_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;