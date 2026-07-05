CREATE TYPE "RecurringPaymentFrequency" AS ENUM ('MONTHLY', 'QUARTERLY', 'ANNUAL', 'ONCE', 'OTHER');

CREATE TYPE "RecurringPaymentStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CANCELED');

CREATE TABLE "RecurringPayment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT,
    "categoryId" TEXT,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "nextChargeDate" TIMESTAMP(3) NOT NULL,
    "frequency" "RecurringPaymentFrequency" NOT NULL,
    "description" TEXT,
    "status" "RecurringPaymentStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringPayment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RecurringPayment_userId_status_idx" ON "RecurringPayment"("userId", "status");
CREATE INDEX "RecurringPayment_userId_nextChargeDate_idx" ON "RecurringPayment"("userId", "nextChargeDate");
CREATE INDEX "RecurringPayment_accountId_idx" ON "RecurringPayment"("accountId");
CREATE INDEX "RecurringPayment_categoryId_idx" ON "RecurringPayment"("categoryId");

ALTER TABLE "RecurringPayment" ADD CONSTRAINT "RecurringPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecurringPayment" ADD CONSTRAINT "RecurringPayment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RecurringPayment" ADD CONSTRAINT "RecurringPayment_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
