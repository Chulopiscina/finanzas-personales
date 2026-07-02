import { AccountType, Role, TransactionType, type Account, type Category, type Transaction } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/format";

type TransactionWithCategory = Transaction & { category: Category | null; account?: Account | null };

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;

export function toNumber(value: unknown) {
  if (value === null || value === undefined) {
    return 0;
  }

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "object" && "toString" in value) {
    return Number(value.toString());
  }

  return Number(value);
}

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthDate(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1));
}

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("es-ES", { month: "short", year: "2-digit" }).format(
    new Date(Date.UTC(year, month - 1, 1))
  );
}

function signedExpense(tx: TransactionWithCategory) {
  const amount = toNumber(tx.amount);
  return tx.type === TransactionType.EXPENSE ? Math.abs(amount) : 0;
}

function signedIncome(tx: TransactionWithCategory) {
  const amount = toNumber(tx.amount);
  return tx.type === TransactionType.INCOME ? Math.abs(amount) : 0;
}

function buildMonthlyRows(transactions: TransactionWithCategory[]) {
  const grouped = new Map<
    string,
    {
      month: string;
      income: number;
      expenses: number;
      savings: number;
      transactions: number;
      categories: Map<string, number>;
    }
  >();

  for (const tx of transactions) {
    const key = monthKey(tx.date);
    const row =
      grouped.get(key) ??
      {
        month: key,
        income: 0,
        expenses: 0,
        savings: 0,
        transactions: 0,
        categories: new Map<string, number>()
      };

    const income = signedIncome(tx);
    const expense = signedExpense(tx);
    row.income += income;
    row.expenses += expense;
    row.savings += income - expense;
    row.transactions += 1;

    if (expense > 0) {
      const category = tx.category?.name ?? "Sin categoría";
      row.categories.set(category, (row.categories.get(category) ?? 0) + expense);
    }

    grouped.set(key, row);
  }

  return [...grouped.values()].sort((a, b) => a.month.localeCompare(b.month));
}

function categoryRows(transactions: TransactionWithCategory[]) {
  const totals = new Map<string, { name: string; value: number; color: string }>();

  for (const tx of transactions) {
    const expense = signedExpense(tx);
    if (expense === 0) {
      continue;
    }

    const name = tx.category?.name ?? "Sin categoría";
    const current = totals.get(name) ?? {
      name,
      value: 0,
      color: tx.category?.color ?? "#94a3b8"
    };
    current.value += expense;
    totals.set(name, current);
  }

  return [...totals.values()].sort((a, b) => b.value - a.value);
}

function buildInsights(monthly: ReturnType<typeof buildMonthlyRows>, categoryTotals: ReturnType<typeof categoryRows>) {
  const current = monthly.at(-1);
  const previous = monthly.at(-2);
  const insights: string[] = [];

  if (current) {
    insights.push(`Este mes has gastado ${formatCurrency(current.expenses)}.`);
    insights.push(`Tu ahorro del mes es de ${formatCurrency(current.savings)}.`);
  }

  if (current && previous && previous.savings !== 0) {
    const change = ((current.savings - previous.savings) / Math.abs(previous.savings)) * 100;
    const direction = change >= 0 ? "más" : "menos";
    insights.push(`Has ahorrado un ${Math.abs(change).toFixed(0)} % ${direction} que el mes anterior.`);
  }

  const topCategory = categoryTotals[0];
  if (topCategory) {
    insights.push(`Tu principal gasto ha sido ${topCategory.name}.`);
  }

  const currentYear = new Date().getUTCFullYear();
  const annualSavings = monthly
    .filter((row) => row.month.startsWith(String(currentYear)))
    .reduce((sum, row) => sum + row.savings, 0);
  insights.push(`Tu ahorro anual es de ${formatCurrency(annualSavings)}.`);

  return insights;
}

function recommendations(categoryTotals: ReturnType<typeof categoryRows>, monthly: ReturnType<typeof buildMonthlyRows>, uncategorized: number) {
  const tips: string[] = [];
  const topCategory = categoryTotals[0];
  const last = monthly.at(-1);

  if (uncategorized > 0) {
    tips.push(`Tienes ${uncategorized} movimientos sin categoría.`);
  }

  if (topCategory && last && last.expenses > 0 && topCategory.value / last.expenses > 0.35) {
    tips.push(`Revisa ${topCategory.name}: concentra más del 35 % del gasto del mes.`);
  }

  if (last && last.savings < 0) {
    tips.push("Este mes los gastos superan a los ingresos. Marca un límite semanal para recuperar margen.");
  }

  if (last && last.savings > 0) {
    tips.push("Este mes has ahorrado más de lo que has gastado.");
  }

  if (tips.length === 0) {
    tips.push("Mantén una revisión semanal de movimientos para detectar suscripciones o duplicados.");
  }

  return tips;
}

export async function ensureDefaultAccount(userId: string) {
  const existing = await prisma.account.findFirst({ where: { userId }, orderBy: { createdAt: "asc" } });
  if (existing) {
    return existing;
  }

  return prisma.account.create({
    data: {
      userId,
      name: "Cuenta principal",
      type: AccountType.BANK,
      color: "#14b8a6",
      icon: "landmark"
    }
  });
}

function accountBalance(account: Account, transactions: TransactionWithCategory[]) {
  const latestWithBalance = transactions.find((tx) => tx.accountId === account.id && tx.balance !== null);
  if (latestWithBalance?.balance !== null && latestWithBalance?.balance !== undefined) {
    return toNumber(latestWithBalance.balance);
  }

  const movementTotal = transactions
    .filter((tx) => tx.accountId === account.id)
    .reduce((sum, tx) => sum + toNumber(tx.amount), 0);
  return toNumber(account.initialBalance) + movementTotal;
}

export async function getDashboardData(userId: string, accountId?: string | null) {
  await ensureDefaultAccount(userId);

  const accounts = await prisma.account.findMany({
    where: { userId },
    orderBy: [{ isArchived: "asc" }, { createdAt: "asc" }]
  });
  const selectedAccount = accountId ? accounts.find((account) => account.id === accountId) ?? null : null;
  const activeAccountIds = accounts.filter((account) => !account.isArchived).map((account) => account.id);
  const accountFilter = selectedAccount ? [selectedAccount.id] : activeAccountIds;

  const [transactions, lastImport, recentImports] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId, accountId: { in: accountFilter.length ? accountFilter : [""] } },
      include: { category: true, account: true },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }]
    }),
    prisma.importHistory.findFirst({
      where: { userId, ...(selectedAccount ? { accountId: selectedAccount.id } : {}) },
      orderBy: { createdAt: "desc" }
    }),
    prisma.importHistory.findMany({
      where: { userId, ...(selectedAccount ? { accountId: selectedAccount.id } : {}) },
      include: { account: true },
      orderBy: { createdAt: "desc" },
      take: 5
    })
  ]);

  const totalIncome = transactions.reduce((sum, tx) => sum + signedIncome(tx), 0);
  const totalExpenses = transactions.reduce((sum, tx) => sum + signedExpense(tx), 0);
  const savings = totalIncome - totalExpenses;
  const currentBalance = selectedAccount
    ? accountBalance(selectedAccount, transactions)
    : accounts.filter((account) => !account.isArchived).reduce((sum, account) => sum + accountBalance(account, transactions), 0);
  const monthly = buildMonthlyRows(transactions);
  const categories = categoryRows(transactions);
  const averageMonthlyExpense =
    monthly.length > 0 ? monthly.reduce((sum, row) => sum + row.expenses, 0) / monthly.length : 0;
  const currentMonthSavings = monthly.at(-1)?.savings ?? 0;
  const uncategorizedCount = transactions.filter((tx) => !tx.categoryId).length;

  return {
    accounts: accounts.map((account) => ({
      id: account.id,
      name: account.name,
      isArchived: account.isArchived,
      color: account.color,
      type: account.type
    })),
    selectedAccount: selectedAccount
      ? { id: selectedAccount.id, name: selectedAccount.name, color: selectedAccount.color, type: selectedAccount.type }
      : null,
    metrics: {
      currentBalance,
      totalIncome,
      totalExpenses,
      accumulatedSavings: savings,
      monthlySavings: currentMonthSavings,
      transactionCount: transactions.length,
      averageMonthlyExpense,
      topCategory: categories[0]?.name ?? "Sin datos",
      lastUpdate: lastImport?.createdAt?.toISOString() ?? null,
      uncategorizedCount
    },
    charts: {
      categories,
      monthly: monthly.slice(-12).map((row) => ({
        month: monthLabel(row.month),
        income: Number(row.income.toFixed(2)),
        expenses: Number(row.expenses.toFixed(2)),
        savings: Number(row.savings.toFixed(2)),
        transactions: row.transactions
      })),
      comparison: monthly.slice(-6).map((row) => ({
        month: monthLabel(row.month),
        gastos: Number(row.expenses.toFixed(2)),
        ingresos: Number(row.income.toFixed(2))
      }))
    },
    insights: buildInsights(monthly, categories),
    recommendations: recommendations(categories, monthly, uncategorizedCount),
    recentImports: recentImports.map((item) => ({
      id: item.id,
      fileName: item.fileName,
      accountName: item.account.name,
      createdAt: item.createdAt.toISOString(),
      insertedRows: item.insertedRows
    })),
    recentTransactions: transactions.slice(0, 8).map((tx) => ({
      id: tx.id,
      date: tx.date.toISOString(),
      concept: tx.cleanDescription || tx.concept,
      amount: toNumber(tx.amount),
      type: tx.type,
      category: tx.category?.name ?? "Sin categoría",
      account: tx.account?.name ?? "Cuenta"
    }))
  };
}

export async function recalculateMonthlySummaries(userId: string) {
  const transactions = await prisma.transaction.findMany({
    where: { userId },
    include: { category: true },
    orderBy: { date: "asc" }
  });

  const monthly = buildMonthlyRows(transactions);

  await prisma.monthlySummary.deleteMany({ where: { userId } });

  for (const row of monthly) {
    const breakdown = [...row.categories.entries()]
      .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
      .sort((a, b) => b.value - a.value);
    const topCategory = breakdown[0]?.name ?? null;
    const insights = buildInsights([row], breakdown.map((item) => ({ ...item, color: "#94a3b8" })));

    await prisma.monthlySummary.upsert({
      where: {
        userId_month: {
          userId,
          month: monthDate(row.month)
        }
      },
      create: {
        userId,
        month: monthDate(row.month),
        income: row.income,
        expenses: row.expenses,
        savings: row.savings,
        transactionCount: row.transactions,
        topCategory,
        categoryBreakdown: breakdown,
        insights
      },
      update: {
        income: row.income,
        expenses: row.expenses,
        savings: row.savings,
        transactionCount: row.transactions,
        topCategory,
        categoryBreakdown: breakdown,
        insights
      }
    });
  }

  return monthly.length;
}

export async function getAdminStats() {
  const [users, transactionCount, importCount, recentImports, recentSessions] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
        _count: { select: { transactions: true, imports: true } }
      }
    }),
    prisma.transaction.count(),
    prisma.importHistory.count(),
    prisma.importHistory.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { user: { select: { name: true, email: true } } }
    }),
    prisma.session.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { user: { select: { name: true, email: true } } }
    })
  ]);

  const roleBreakdown = {
    admins: users.filter((user) => user.role === Role.ADMIN).length,
    users: users.filter((user) => user.role === Role.USER).length
  };

  return {
    users,
    metrics: {
      userCount: users.length,
      transactionCount,
      importCount,
      admins: roleBreakdown.admins,
      regularUsers: roleBreakdown.users
    },
    recentActivity: [
      ...recentImports.map((item) => ({
        id: `import-${item.id}`,
        type: "Importación",
        user: item.user.name,
        detail: `${item.insertedRows} insertados, ${item.duplicateRows} duplicados`,
        date: item.createdAt.toISOString()
      })),
      ...recentSessions.map((item) => ({
        id: `session-${item.id}`,
        type: "Inicio de sesión",
        user: item.user.name,
        detail: item.userAgent ?? "Sesión web",
        date: item.createdAt.toISOString()
      }))
    ]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 10)
  };
}