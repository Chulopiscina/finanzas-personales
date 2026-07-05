import { RecurringPaymentsManager } from "@/components/recurring-payments-manager";
import { getSessionUser } from "@/lib/auth";
import { toNumber } from "@/lib/finance";
import { daysUntil, nextRecurringPaymentDate } from "@/lib/recurring-payments";
import { prisma } from "@/lib/prisma";

export default async function RecurringPaymentsPage() {
  const session = await getSessionUser();
  if (!session) return null;

  const [payments, accounts, categories] = await Promise.all([
    prisma.recurringPayment.findMany({
      where: { userId: session.user.id },
      include: { account: { select: { id: true, name: true } }, category: { select: { id: true, name: true, color: true } } },
      orderBy: [{ status: "asc" }, { nextChargeDate: "asc" }, { createdAt: "desc" }]
    }),
    prisma.account.findMany({ where: { userId: session.user.id, isArchived: false }, orderBy: { createdAt: "asc" }, select: { id: true, name: true } }),
    prisma.category.findMany({ where: { OR: [{ userId: null }, { userId: session.user.id }], isArchived: false }, orderBy: { name: "asc" }, select: { id: true, name: true, color: true } })
  ]);

  const preparedPayments = payments.map((payment) => {
    const projected = nextRecurringPaymentDate(payment.nextChargeDate, payment.frequency);
    return {
      id: payment.id,
      name: payment.name,
      amount: toNumber(payment.amount),
      nextChargeDate: payment.nextChargeDate.toISOString(),
      projectedDate: projected?.toISOString() ?? null,
      daysUntil: projected ? daysUntil(projected) : null,
      frequency: payment.frequency,
      accountId: payment.accountId ?? "",
      accountName: payment.account?.name ?? null,
      categoryId: payment.categoryId ?? "",
      categoryName: payment.category?.name ?? null,
      description: payment.description ?? "",
      status: payment.status
    };
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-normal text-foreground">Pagos recurrentes</h1>
        <p className="text-sm text-muted-foreground">Planifica cobros futuros sin convertirlos en movimientos reales.</p>
      </header>
      <RecurringPaymentsManager initialPayments={preparedPayments} accounts={accounts} categories={categories} />
    </div>
  );
}
