import { TransactionType } from "@prisma/client";
import { TransactionsTable } from "@/components/transactions-table";
import { getAuthorizedUserId, getSessionUser } from "@/lib/auth";
import { ensureDefaultAccount, toNumber } from "@/lib/finance";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE_OPTIONS = [25, 50] as const;
const DEFAULT_PAGE_SIZE = 50;

type Props = {
  searchParams?: Promise<{ userId?: string; accountId?: string; categoryId?: string; type?: string; importId?: string; planningGoalId?: string; q?: string; page?: string; pageSize?: string }>;
};

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parsePageSize(value: string | undefined) {
  const parsed = parsePositiveInt(value, DEFAULT_PAGE_SIZE);
  return PAGE_SIZE_OPTIONS.includes(parsed as 25 | 50) ? parsed : DEFAULT_PAGE_SIZE;
}

export default async function MovementsPage({ searchParams }: Props) {
  const session = await getSessionUser();
  if (!session) {
    return null;
  }

  const params = await searchParams;
  const userId = getAuthorizedUserId(session.user, params?.userId);
  await ensureDefaultAccount(userId);

  const planningGoalFilter = params?.planningGoalId ?? "";
  const query = params?.q?.trim() ?? "";
  const pageSize = parsePageSize(params?.pageSize);
  const requestedPage = parsePositiveInt(params?.page, 1);
  const typeFilter = params?.type && [TransactionType.INCOME, TransactionType.EXPENSE, TransactionType.TRANSFER].includes(params.type as TransactionType)
    ? (params.type as TransactionType)
    : undefined;
  const planningWhere = planningGoalFilter === "__none"
    ? { planningGoals: { none: {} } }
    : planningGoalFilter === "__any"
      ? { planningGoals: { some: {} } }
      : planningGoalFilter
        ? { planningGoals: { some: { goalId: planningGoalFilter } } }
        : {};
  const searchWhere = query
    ? {
        OR: [
          { concept: { contains: query, mode: "insensitive" as const } },
          { cleanDescription: { contains: query, mode: "insensitive" as const } },
          { rawDescription: { contains: query, mode: "insensitive" as const } },
          { category: { name: { contains: query, mode: "insensitive" as const } } },
          { account: { name: { contains: query, mode: "insensitive" as const } } }
        ]
      }
    : {};
  const where = {
    userId,
    ...(params?.accountId ? { accountId: params.accountId } : {}),
    ...(params?.categoryId ? { categoryId: params.categoryId } : {}),
    ...(typeFilter ? { type: typeFilter } : {}),
    ...(params?.importId ? { importHistoryId: params.importId } : {}),
    ...planningWhere,
    ...searchWhere
  };

  const total = await prisma.transaction.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);

  const [transactions, categories, accounts, imports, planningGoals] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: {
        category: true,
        account: true,
        importHistory: { select: { id: true, fileName: true } },
        planningGoals: { include: { goal: { select: { id: true, name: true, color: true, status: true } } }, orderBy: { createdAt: "asc" } },
        reimbursementLinks: { include: { expense: { include: { account: true, category: true } } } },
        reimbursedByLinks: { include: { reimbursement: { include: { account: true, category: true } } } }
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize
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
        <p className="text-sm text-muted-foreground">Clasificaci&oacute;n, cuenta, origen, objetivos y edici&oacute;n manual</p>
      </header>
      <TransactionsTable
        accounts={accounts.map((account) => ({ id: account.id, name: account.name, isArchived: account.isArchived }))}
        categories={categories}
        imports={imports}
        planningGoals={planningGoals}
        initialFilters={{ accountId: params?.accountId ?? "", categoryId: params?.categoryId ?? "", type: params?.type ?? "", importId: params?.importId ?? "", planningGoalId: planningGoalFilter, query }}
        pagination={{ page, pageSize, total, totalPages }}
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
          isFixedExpense: tx.isFixedExpense,
          internalTransferCounterAccountId: tx.internalTransferCounterAccountId
        }))}
      />
    </div>
  );
}