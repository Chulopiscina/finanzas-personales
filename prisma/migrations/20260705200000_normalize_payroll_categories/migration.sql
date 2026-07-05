INSERT INTO "Category" ("id", "userId", "name", "type", "color", "icon", "isArchived", "createdAt", "updatedAt")
SELECT 'canonical-payroll-category', NULL, U&'N\00F3mina', 'INCOME', '#10b981', 'wallet', false, NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "Category" WHERE "userId" IS NULL AND "name" = U&'N\00F3mina'
);

UPDATE "Category"
SET "type" = 'INCOME', "isArchived" = false, "name" = U&'N\00F3mina', "color" = COALESCE(NULLIF("color", ''), '#10b981'), "icon" = COALESCE(NULLIF("icon", ''), 'wallet')
WHERE "id" = (SELECT "id" FROM "Category" WHERE "userId" IS NULL AND "name" = U&'N\00F3mina' ORDER BY "createdAt", "id" LIMIT 1);

WITH canonical AS (
  SELECT "id" FROM "Category" WHERE "userId" IS NULL AND "name" = U&'N\00F3mina' ORDER BY "createdAt", "id" LIMIT 1
), duplicate_categories AS (
  SELECT c."id"
  FROM "Category" c, canonical
  WHERE c."id" <> canonical."id"
    AND regexp_replace(lower(translate(c."name", U&'\00E1\00E9\00ED\00F3\00FA\00C1\00C9\00CD\00D3\00DA\00F1\00D1', 'aeiouAEIOUnN')), '[^a-z0-9]+', '', 'g') IN ('nomina', 'nominas', 'nomines')
)
UPDATE "Transaction"
SET "categoryId" = (SELECT "id" FROM canonical), "type" = 'INCOME', "isInternalTransfer" = false, "isFixedExpense" = false, "internalTransferGroupId" = NULL, "internalTransferCounterAccountId" = NULL
WHERE "categoryId" IN (SELECT "id" FROM duplicate_categories);

WITH canonical AS (
  SELECT "id" FROM "Category" WHERE "userId" IS NULL AND "name" = U&'N\00F3mina' ORDER BY "createdAt", "id" LIMIT 1
), payroll_transactions AS (
  SELECT t."id"
  FROM "Transaction" t
  LEFT JOIN "Category" c ON c."id" = t."categoryId"
  WHERE regexp_replace(lower(translate(concat_ws(' ', t."concept", t."cleanDescription", t."rawDescription", c."name"), U&'\00E1\00E9\00ED\00F3\00FA\00C1\00C9\00CD\00D3\00DA\00F1\00D1', 'aeiouAEIOUnN')), '[^a-z0-9]+', ' ', 'g') ~ '(^| )(abono de nomina|transferencia nomina|nomina|nominas|nomines)( |$)'
)
UPDATE "Transaction"
SET "categoryId" = (SELECT "id" FROM canonical), "type" = 'INCOME', "isInternalTransfer" = false, "isFixedExpense" = false, "internalTransferGroupId" = NULL, "internalTransferCounterAccountId" = NULL
WHERE "id" IN (SELECT "id" FROM payroll_transactions);

WITH canonical AS (
  SELECT "id" FROM "Category" WHERE "userId" IS NULL AND "name" = U&'N\00F3mina' ORDER BY "createdAt", "id" LIMIT 1
), duplicate_categories AS (
  SELECT c."id"
  FROM "Category" c, canonical
  WHERE c."id" <> canonical."id"
    AND regexp_replace(lower(translate(c."name", U&'\00E1\00E9\00ED\00F3\00FA\00C1\00C9\00CD\00D3\00DA\00F1\00D1', 'aeiouAEIOUnN')), '[^a-z0-9]+', '', 'g') IN ('nomina', 'nominas', 'nomines')
)
INSERT INTO "PlanningGoalCategory" ("goalId", "categoryId")
SELECT pgc."goalId", (SELECT "id" FROM canonical)
FROM "PlanningGoalCategory" pgc
WHERE pgc."categoryId" IN (SELECT "id" FROM duplicate_categories)
ON CONFLICT DO NOTHING;

WITH canonical AS (
  SELECT "id" FROM "Category" WHERE "userId" IS NULL AND "name" = U&'N\00F3mina' ORDER BY "createdAt", "id" LIMIT 1
), duplicate_categories AS (
  SELECT c."id"
  FROM "Category" c, canonical
  WHERE c."id" <> canonical."id"
    AND regexp_replace(lower(translate(c."name", U&'\00E1\00E9\00ED\00F3\00FA\00C1\00C9\00CD\00D3\00DA\00F1\00D1', 'aeiouAEIOUnN')), '[^a-z0-9]+', '', 'g') IN ('nomina', 'nominas', 'nomines')
)
DELETE FROM "PlanningGoalCategory" WHERE "categoryId" IN (SELECT "id" FROM duplicate_categories);

WITH canonical AS (
  SELECT "id" FROM "Category" WHERE "userId" IS NULL AND "name" = U&'N\00F3mina' ORDER BY "createdAt", "id" LIMIT 1
), duplicate_categories AS (
  SELECT c."id"
  FROM "Category" c, canonical
  WHERE c."id" <> canonical."id"
    AND regexp_replace(lower(translate(c."name", U&'\00E1\00E9\00ED\00F3\00FA\00C1\00C9\00CD\00D3\00DA\00F1\00D1', 'aeiouAEIOUnN')), '[^a-z0-9]+', '', 'g') IN ('nomina', 'nominas', 'nomines')
)
INSERT INTO "MonthlyBudgetCategory" ("budgetId", "categoryId", "block")
SELECT mbc."budgetId", (SELECT "id" FROM canonical), mbc."block"
FROM "MonthlyBudgetCategory" mbc
WHERE mbc."categoryId" IN (SELECT "id" FROM duplicate_categories)
ON CONFLICT DO NOTHING;

WITH canonical AS (
  SELECT "id" FROM "Category" WHERE "userId" IS NULL AND "name" = U&'N\00F3mina' ORDER BY "createdAt", "id" LIMIT 1
), duplicate_categories AS (
  SELECT c."id"
  FROM "Category" c, canonical
  WHERE c."id" <> canonical."id"
    AND regexp_replace(lower(translate(c."name", U&'\00E1\00E9\00ED\00F3\00FA\00C1\00C9\00CD\00D3\00DA\00F1\00D1', 'aeiouAEIOUnN')), '[^a-z0-9]+', '', 'g') IN ('nomina', 'nominas', 'nomines')
)
DELETE FROM "MonthlyBudgetCategory" WHERE "categoryId" IN (SELECT "id" FROM duplicate_categories);

WITH canonical AS (
  SELECT "id" FROM "Category" WHERE "userId" IS NULL AND "name" = U&'N\00F3mina' ORDER BY "createdAt", "id" LIMIT 1
), duplicate_categories AS (
  SELECT c."id"
  FROM "Category" c, canonical
  WHERE c."id" <> canonical."id"
    AND regexp_replace(lower(translate(c."name", U&'\00E1\00E9\00ED\00F3\00FA\00C1\00C9\00CD\00D3\00DA\00F1\00D1', 'aeiouAEIOUnN')), '[^a-z0-9]+', '', 'g') IN ('nomina', 'nominas', 'nomines')
)
UPDATE "RecurringPayment"
SET "categoryId" = (SELECT "id" FROM canonical)
WHERE "categoryId" IN (SELECT "id" FROM duplicate_categories);

WITH canonical AS (
  SELECT "id" FROM "Category" WHERE "userId" IS NULL AND "name" = U&'N\00F3mina' ORDER BY "createdAt", "id" LIMIT 1
), duplicate_categories AS (
  SELECT c."id"
  FROM "Category" c, canonical
  WHERE c."id" <> canonical."id"
    AND regexp_replace(lower(translate(c."name", U&'\00E1\00E9\00ED\00F3\00FA\00C1\00C9\00CD\00D3\00DA\00F1\00D1', 'aeiouAEIOUnN')), '[^a-z0-9]+', '', 'g') IN ('nomina', 'nominas', 'nomines')
)
DELETE FROM "Category" WHERE "id" IN (SELECT "id" FROM duplicate_categories);