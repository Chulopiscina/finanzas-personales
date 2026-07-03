import { TransactionsTable } from "@/components/transactions-table";
import { getAuthorizedUserId, getSessionUser } from "@/lib/auth";
import { detectAndMarkInternalTransfers, ensureDefaultAccount, toNumber } from "@/lib/finance";
import { prisma } from "@/lib/prisma";

type Props = {
  searchParams?: Promise<{ userId?: string; accountId?: string; categoryId?: string; type?: string; importId?: string; planningGoalId?: string }>;
};

export default async function MovementsPage({ searchParams }: Props) {
  const session = await getSessionUser();
  if (!session) {
    return null;
  }

  const params = await searchParams;
  const userId = getAuthorizedUserId(session.user, params?.userId);
  await ensureDefaultAccount(userId);
  await detectAndMarkInternalTransfers(userId);

  const planningGoalFilter = params?.planningGoalId ?? "";
  const planningWhere = planningGoalFilter === "__none"
    ? { planningGoals: { none: {} } }
    : planningGoalFilter === "__any"
      ? { planningGoals: { some: {} } }
      : planningGoalFilter
        ? { planningGoals: { some: { goalId: planningGoalFilter } } }
        : {};

  const [transactions, categories, accounts, imports, planningGoals] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        userId,
        ...(params?.accountId ? { accountId: params.accountId } : {}),
        ...(params?.categoryId ? { categoryId: params.categoryId } : {}),
        ...(params?.type && ["INCOME", "EXPENSE", "TRANSFER"].includes(params.type) ? { type: params.type as "INCOME" | "EXPENSE" | "TRANSFER" } : {}),
        ...(params?.importId ? { importHistoryId: params.importId } : {}),
        ...planningWhere
      },
      include: {
        category: true,
        account: true,
        importHistory: { select: { id: true, fileName: true } },
        planningGoals: { include: { goal: { select: { id: true, name: true, color: true, status: true } } }, orderBy: { createdAt: "asc" } },
        reimbursementLinks: { include: { expense: { include: { account: true, category: true } } } },
        reimbursedByLinks: { include: { reimbursement: { include: { account: true, category: true } } } }
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 500
    }),
    prisma.category.findMany({
      where: { OR: [{ userId: null }, { userId }], isArchived: false },
      orderBy: { name: "asc" }
    }),
    prisma.account.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.importHistory.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 50, select: { id: true, fileName: true } }),
    prisma.planningGoal.findMany({
      where: { userId, status: { in: ["ACTIVE", "PAUSED", "COMPLETED"] } },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      select: { id: true, name: true, color: true, status: true }
    })
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-normal text-foreground">Movimientos</h1>
        <p className="text-sm text-muted-foreground">Clasificación, cuenta, origen, objetivos y edición manual</p>
      </header>
      <TransactionsTable
        accounts={accounts.map((account) => ({ id: account.id, name: account.name, isArchived: account.isArchived }))}
        categories={categories}
        imports={imports}
        planningGoals={planningGoals}
        initialFilters={{ accountId: params?.accountId ?? "", categoryId: params?.categoryId ?? "", type: params?.type ?? "", importId: params?.importId ?? "", planningGoalId: planningGoalFilter }}
        initialTransactions={transactions.map((tx) => ({
          id: tx.id,
          date: tx.date.toISOString(),
          concept: tx.concept,
          cleanDescription: tx.cleanDescription,
          amount: toNumber(tx.amount),
          balance: tx.balance === null ? null : toNumber(tx.balance),
          type: tx.type,
          categoryId: tx.categoryId,
          category: tx.category,
          accountId: tx.accountId,
          account: tx.account,
          importHistory: tx.importHistory,
          planningGoals: tx.planningGoals,
          reimbursementLinks: tx.reimbursementLinks,
          reimbursedByLinks: tx.reimbursedByLinks,
          isInternalTransfer: tx.isInternalTransfer,
          internalTransferCounterAccountId: tx.internalTransferCounterAccountId
        }))}
      />
    </div>
  );
}