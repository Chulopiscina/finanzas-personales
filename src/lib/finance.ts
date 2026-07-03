import { AccountType, Role, TransactionType, type Account, type Category, type Transaction } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/format";

type ReimbursementLink = {
  expenseId: string;
  reimbursementId: string;
  expense?: TransactionWithCategory;
  reimbursement?: TransactionWithCategory;
};

type TransactionWithCategory = Transaction & {
  category: Category | null;
  account?: Account | null;
  reimbursementLinks?: ReimbursementLink[];
  reimbursedByLinks?: ReimbursementLink[];
};

export type DashboardPeriod = "last-imported-month" | "last-3-months" | "current-year" | "all";
export type DashboardDetailKey = "realIncome" | "grossExpenses" | "reimbursements" | "netExpenses" | "periodResult" | "internalTransfers" | "topCategory" | "uncategorized" | "averageMonthlyNetExpense";
export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;

export function toNumber(value: unknown) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "object" && "toString" in value) return Number(value.toString());
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
  return new Intl.DateTimeFormat("es-ES", { month: "short", year: "2-digit" }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function startOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addMonths(date: Date, months: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

function signedExpense(tx: TransactionWithCategory) {
  const amount = toNumber(tx.amount);
  return tx.type === TransactionType.EXPENSE && !tx.isInternalTransfer ? Math.abs(amount) : 0;
}

function signedIncome(tx: TransactionWithCategory) {
  const amount = toNumber(tx.amount);
  return tx.type === TransactionType.INCOME && !tx.isInternalTransfer ? Math.abs(amount) : 0;
}

function isReimbursement(tx: TransactionWithCategory) {
  return tx.type === TransactionType.INCOME && !tx.isInternalTransfer && (tx.reimbursementLinks?.length ?? 0) > 0;
}

function realIncome(tx: TransactionWithCategory) {
  return signedIncome(tx) > 0 && !isReimbursement(tx) ? Math.abs(toNumber(tx.amount)) : 0;
}

function periodRange(period: DashboardPeriod, transactions: TransactionWithCategory[]) {
  if (period === "all") {
    return { start: null, end: null, label: "Todo" };
  }

  const latest = transactions[0]?.date ?? new Date();
  if (period === "current-year") {
    const year = new Date().getUTCFullYear();
    return { start: new Date(Date.UTC(year, 0, 1)), end: new Date(Date.UTC(year + 1, 0, 1)), label: String(year) };
  }

  const latestMonth = startOfMonth(latest);
  if (period === "last-3-months") {
    return { start: addMonths(latestMonth, -2), end: addMonths(latestMonth, 1), label: "Últimos 3 meses" };
  }

  return { start: latestMonth, end: addMonths(latestMonth, 1), label: "Último mes importado" };
}

function inPeriod(tx: TransactionWithCategory, range: ReturnType<typeof periodRange>) {
  return (!range.start || tx.date >= range.start) && (!range.end || tx.date < range.end);
}

function reimbursementAllocation(transactions: TransactionWithCategory[]) {
  const periodExpenseIds = new Set(transactions.filter((tx) => signedExpense(tx) > 0).map((tx) => tx.id));
  const allocations = new Map<string, number>();
  const reimbursements = transactions.filter(isReimbursement);

  for (const reimbursement of reimbursements) {
    const linkedExpenses: TransactionWithCategory[] = [];
    for (const link of reimbursement.reimbursementLinks ?? []) {
      if (link.expense && periodExpenseIds.has(link.expense.id)) {
        linkedExpenses.push(link.expense);
      }
    }

    if (linkedExpenses.length === 0) continue;
    const reimbursementAmount = Math.abs(toNumber(reimbursement.amount));
    const linkedGross = linkedExpenses.reduce((sum, expense) => sum + signedExpense(expense), 0);
    if (linkedGross <= 0) continue;

    for (const expense of linkedExpenses) {
      const share = reimbursementAmount * (signedExpense(expense) / linkedGross);
      allocations.set(expense.id, (allocations.get(expense.id) ?? 0) + share);
    }
  }

  return allocations;
}

function buildMonthlyRows(transactions: TransactionWithCategory[]) {
  const allocations = reimbursementAllocation(transactions);
  const grouped = new Map<string, { month: string; income: number; grossExpenses: number; reimbursements: number; netExpenses: number; savings: number; transactions: number; categories: Map<string, number> }>();

  for (const tx of transactions) {
    const key = monthKey(tx.date);
    const row = grouped.get(key) ?? { month: key, income: 0, grossExpenses: 0, reimbursements: 0, netExpenses: 0, savings: 0, transactions: 0, categories: new Map<string, number>() };
    const income = realIncome(tx);
    const expense = signedExpense(tx);
    const reimbursement = isReimbursement(tx) ? Math.abs(toNumber(tx.amount)) : 0;
    const allocation = allocations.get(tx.id) ?? 0;
    const netExpense = Math.max(0, expense - allocation);

    row.income += income;
    row.grossExpenses += expense;
    row.reimbursements += reimbursement;
    row.netExpenses += netExpense;
    row.savings += income - netExpense;
    row.transactions += 1;

    if (netExpense > 0) {
      const category = tx.category?.name ?? "Sin categoría";
      row.categories.set(category, (row.categories.get(category) ?? 0) + netExpense);
    }

    grouped.set(key, row);
  }

  return [...grouped.values()].sort((a, b) => a.month.localeCompare(b.month));
}

function categoryRows(transactions: TransactionWithCategory[]) {
  const allocations = reimbursementAllocation(transactions);
  const totals = new Map<string, { name: string; value: number; color: string; gross: number; reimbursements: number }>();

  for (const tx of transactions) {
    const expense = signedExpense(tx);
    if (expense === 0) continue;
    const allocation = allocations.get(tx.id) ?? 0;
    const value = Math.max(0, expense - allocation);
    if (value === 0) continue;
    const name = tx.category?.name ?? "Sin categoría";
    const current = totals.get(name) ?? { name, value: 0, color: tx.category?.color ?? "#94a3b8", gross: 0, reimbursements: 0 };
    current.value += value;
    current.gross += expense;
    current.reimbursements += allocation;
    totals.set(name, current);
  }

  return [...totals.values()].sort((a, b) => b.value - a.value);
}

function buildInsights(monthly: ReturnType<typeof buildMonthlyRows>, categoryTotals: ReturnType<typeof categoryRows>) {
  const current = monthly.at(-1);
  const previous = monthly.at(-2);
  const insights: string[] = [];

  if (current) {
    insights.push(`Este periodo has gastado neto ${formatCurrency(current.netExpenses)}.`);
    insights.push(`Tu resultado del periodo es de ${formatCurrency(current.savings)}.`);
  }

  if (current && previous && previous.savings !== 0) {
    const change = ((current.savings - previous.savings) / Math.abs(previous.savings)) * 100;
    const direction = change >= 0 ? "más" : "menos";
    insights.push(`El resultado es un ${Math.abs(change).toFixed(0)} % ${direction} que el mes anterior.`);
  }

  const topCategory = categoryTotals[0];
  if (topCategory) insights.push(`Tu principal gasto neto ha sido ${topCategory.name}.`);
  return insights.length ? insights : ["Sin datos suficientes para generar resumen del periodo."];
}

function recommendations(categoryTotals: ReturnType<typeof categoryRows>, monthly: ReturnType<typeof buildMonthlyRows>, uncategorized: number) {
  const tips: string[] = [];
  const topCategory = categoryTotals[0];
  const last = monthly.at(-1);
  if (uncategorized > 0) tips.push(`Tienes ${uncategorized} movimientos sin categoría.`);
  if (topCategory && last && last.netExpenses > 0 && topCategory.value / last.netExpenses > 0.35) tips.push(`Revisa ${topCategory.name}: concentra más del 35 % del gasto neto del periodo.`);
  if (last && last.savings < 0) tips.push("El resultado del periodo es negativo. Revisa gastos netos y reembolsos pendientes.");
  if (last && last.savings > 0) tips.push("El resultado del periodo es positivo.");
  if (tips.length === 0) tips.push("Mantén una revisión semanal de movimientos para detectar reembolsos pendientes o categorías mejorables.");
  return tips;
}

const internalTransferConceptPattern = /\b(transferencia|traspaso|transfer|ahorro|trade republic|bbva|ing|movimiento|emitida|recibida|inbound|outbound)\b/i;

function transferCandidate(tx: TransactionWithCategory) {
  const concept = `${tx.concept} ${tx.cleanDescription ?? ""} ${tx.rawDescription ?? ""} ${tx.account?.name ?? ""}`;
  return tx.type === TransactionType.TRANSFER || internalTransferConceptPattern.test(concept);
}

function possibleInternalTransferPair(outgoing: TransactionWithCategory, incoming: TransactionWithCategory) {
  const outAmount = Math.abs(toNumber(outgoing.amount));
  return transferCandidate(outgoing) || transferCandidate(incoming) || outAmount >= 1000;
}

function closeEnoughAmount(left: number, right: number) {
  const diff = Math.abs(Math.abs(left) - Math.abs(right));
  return diff <= Math.max(1, Math.abs(left) * 0.001);
}

function closeEnoughDate(left: Date, right: Date) {
  return Math.abs(left.getTime() - right.getTime()) / 86_400_000 <= 7;
}

function hasPairedInternalTransfer(tx: TransactionWithCategory) {
  return tx.isInternalTransfer && Boolean(tx.internalTransferGroupId?.startsWith("internal-"));
}

export async function detectAndMarkInternalTransfers(userId: string) {
  const transactions = await prisma.transaction.findMany({ where: { userId }, include: { category: true, account: true }, orderBy: [{ date: "asc" }, { createdAt: "asc" }] });
  const candidates = transactions.filter((tx) => toNumber(tx.amount) !== 0);
  const used = new Set<string>();
  const updates: Array<{ outId: string; inId: string; outAccountId: string; inAccountId: string }> = [];

  for (const outgoing of candidates) {
    const outAmount = toNumber(outgoing.amount);
    if (outAmount >= 0 || used.has(outgoing.id) || hasPairedInternalTransfer(outgoing)) continue;
    const incoming = candidates.find((candidate) => {
      const inAmount = toNumber(candidate.amount);
      const alreadyLinked = outgoing.isInternalTransfer && candidate.isInternalTransfer && outgoing.internalTransferGroupId !== null && outgoing.internalTransferGroupId === candidate.internalTransferGroupId;
      return inAmount > 0 && !used.has(candidate.id) && !alreadyLinked && !hasPairedInternalTransfer(candidate) && candidate.accountId !== outgoing.accountId && closeEnoughAmount(outAmount, inAmount) && closeEnoughDate(outgoing.date, candidate.date) && possibleInternalTransferPair(outgoing, candidate);
    });
    if (!incoming) continue;
    used.add(outgoing.id);
    used.add(incoming.id);
    updates.push({ outId: outgoing.id, inId: incoming.id, outAccountId: outgoing.accountId, inAccountId: incoming.accountId });
  }

  for (const pair of updates) {
    const groupId = `internal-${[pair.outId, pair.inId].sort().join("-")}`;
    await prisma.$transaction([
      prisma.transaction.update({ where: { id: pair.outId }, data: { type: TransactionType.TRANSFER, isInternalTransfer: true, internalTransferGroupId: groupId, internalTransferCounterAccountId: pair.inAccountId } }),
      prisma.transaction.update({ where: { id: pair.inId }, data: { type: TransactionType.TRANSFER, isInternalTransfer: true, internalTransferGroupId: groupId, internalTransferCounterAccountId: pair.outAccountId } })
    ]);
  }

  return updates.length;
}

export async function ensureDefaultAccount(userId: string) {
  const existing = await prisma.account.findFirst({ where: { userId }, orderBy: { createdAt: "asc" } });
  if (existing) return existing;
  return prisma.account.create({ data: { userId, name: "Cuenta principal", type: AccountType.BANK, color: "#14b8a6", icon: "landmark" } });
}

export function accountBalance(account: Account, transactions: Array<Pick<Transaction, "accountId" | "amount" | "balance">>) {
  const accountTransactions = transactions.filter((tx) => tx.accountId === account.id);
  const latestWithBalance = accountTransactions.find((tx) => tx.balance !== null);
  if (latestWithBalance?.balance !== null && latestWithBalance?.balance !== undefined) return toNumber(latestWithBalance.balance);
  return toNumber(account.initialBalance) + accountTransactions.reduce((sum, tx) => sum + toNumber(tx.amount), 0);
}

function internalTransferTotal(transactions: TransactionWithCategory[], selectedAccount: Account | null) {
  const internal = transactions.filter((tx) => tx.isInternalTransfer);
  if (selectedAccount) return internal.reduce((sum, tx) => sum + Math.abs(toNumber(tx.amount)), 0);
  const grouped = new Map<string, number>();
  for (const tx of internal) {
    const key = tx.internalTransferGroupId ?? tx.id;
    grouped.set(key, Math.max(grouped.get(key) ?? 0, Math.abs(toNumber(tx.amount))));
  }
  return [...grouped.values()].reduce((sum, amount) => sum + amount, 0);
}

function detailRow(tx: TransactionWithCategory) {
  const linkedExpenses = (tx.reimbursementLinks ?? []).map((link) => link.expense?.cleanDescription || link.expense?.concept).filter(Boolean) as string[];
  const linkedReimbursements = (tx.reimbursedByLinks ?? []).map((link) => link.reimbursement?.cleanDescription || link.reimbursement?.concept).filter(Boolean) as string[];
  return {
    id: tx.id,
    date: tx.date.toISOString(),
    concept: tx.cleanDescription || tx.concept,
    account: tx.account?.name ?? "Cuenta",
    category: tx.category?.name ?? "Sin categoría",
    amount: toNumber(tx.amount),
    type: tx.type,
    isInternalTransfer: tx.isInternalTransfer,
    isReimbursement: isReimbursement(tx),
    linkedMovements: [...linkedExpenses, ...linkedReimbursements]
  };
}

export async function getDashboardData(userId: string, accountId?: string | null, period: DashboardPeriod = "last-imported-month") {
  await ensureDefaultAccount(userId);
  await detectAndMarkInternalTransfers(userId);

  const accounts = await prisma.account.findMany({ where: { userId }, orderBy: [{ isArchived: "asc" }, { createdAt: "asc" }] });
  const selectedAccount = accountId ? accounts.find((account) => account.id === accountId) ?? null : null;
  const activeAccountIds = accounts.filter((account) => !account.isArchived).map((account) => account.id);
  const accountFilter = selectedAccount ? [selectedAccount.id] : activeAccountIds;

  const transactionInclude = {
    category: true,
    account: true,
    reimbursementLinks: { include: { expense: { include: { category: true, account: true } } } },
    reimbursedByLinks: { include: { reimbursement: { include: { category: true, account: true } } } }
  };

  const [allTransactions, balanceTransactions, lastImport, recentImports] = await Promise.all([
    prisma.transaction.findMany({ where: { userId, accountId: { in: accountFilter.length ? accountFilter : [""] } }, include: transactionInclude, orderBy: [{ date: "desc" }, { createdAt: "desc" }] }),
    prisma.transaction.findMany({ where: { userId, accountId: { in: accountFilter.length ? accountFilter : [""] } }, select: { accountId: true, amount: true, balance: true }, orderBy: [{ date: "desc" }, { createdAt: "desc" }] }),
    prisma.importHistory.findFirst({ where: { userId, ...(selectedAccount ? { accountId: selectedAccount.id } : {}) }, orderBy: { createdAt: "desc" } }),
    prisma.importHistory.findMany({ where: { userId, ...(selectedAccount ? { accountId: selectedAccount.id } : {}) }, include: { account: true }, orderBy: { createdAt: "desc" }, take: 5 })
  ]);

  const range = periodRange(period, allTransactions);
  const transactions = allTransactions.filter((tx) => inPeriod(tx, range));
  const allocations = reimbursementAllocation(transactions);
  const incomeTransactions = transactions.filter((tx) => realIncome(tx) > 0);
  const expenseTransactions = transactions.filter((tx) => signedExpense(tx) > 0);
  const reimbursementTransactions = transactions.filter(isReimbursement);
  const internalTransactions = transactions.filter((tx) => tx.isInternalTransfer);
  const uncategorizedTransactions = transactions.filter((tx) => !tx.categoryId && !tx.isInternalTransfer);

  const totalIncome = incomeTransactions.reduce((sum, tx) => sum + realIncome(tx), 0);
  const grossExpenses = expenseTransactions.reduce((sum, tx) => sum + signedExpense(tx), 0);
  const reimbursements = reimbursementTransactions.reduce((sum, tx) => sum + Math.abs(toNumber(tx.amount)), 0);
  const netExpenses = grossExpenses - reimbursements;
  const result = totalIncome - netExpenses;
  const currentBalance = selectedAccount ? accountBalance(selectedAccount, balanceTransactions) : accounts.filter((account) => !account.isArchived).reduce((sum, account) => sum + accountBalance(account, balanceTransactions), 0);
  const transferTotal = internalTransferTotal(transactions, selectedAccount);
  const monthly = buildMonthlyRows(transactions);
  const categories = categoryRows(transactions);
  const averageMonthlyExpense = monthly.length > 0 ? monthly.reduce((sum, row) => sum + row.netExpenses, 0) / monthly.length : 0;
  const currentMonthSavings = monthly.at(-1)?.savings ?? 0;
  const topCategory = categories[0] ?? null;
  const topCategoryTransactions = topCategory ? expenseTransactions.filter((tx) => (tx.category?.name ?? "Sin categoría") === topCategory.name) : [];

  const netExpenseDetailIds = new Set([...expenseTransactions.map((tx) => tx.id), ...reimbursementTransactions.map((tx) => tx.id)]);
  const details = {
    realIncome: incomeTransactions.map(detailRow),
    grossExpenses: expenseTransactions.map(detailRow),
    reimbursements: reimbursementTransactions.map(detailRow),
    netExpenses: transactions.filter((tx) => netExpenseDetailIds.has(tx.id)).map(detailRow),
    periodResult: [...incomeTransactions, ...expenseTransactions, ...reimbursementTransactions].map(detailRow),
    internalTransfers: internalTransactions.map(detailRow),
    topCategory: topCategoryTransactions.map(detailRow),
    uncategorized: uncategorizedTransactions.map(detailRow),
    averageMonthlyNetExpense: transactions.filter((tx) => netExpenseDetailIds.has(tx.id)).map(detailRow)
  };

  return {
    period,
    periodLabel: range.label,
    accounts: accounts.map((account) => ({ id: account.id, name: account.name, isArchived: account.isArchived, color: account.color, type: account.type })),
    selectedAccount: selectedAccount ? { id: selectedAccount.id, name: selectedAccount.name, color: selectedAccount.color, type: selectedAccount.type } : null,
    metrics: {
      currentBalance,
      totalIncome,
      totalExpenses: grossExpenses,
      grossExpenses,
      reimbursements,
      netExpenses,
      accumulatedSavings: result,
      periodResult: result,
      monthlySavings: currentMonthSavings,
      transactionCount: transactions.length,
      averageMonthlyExpense,
      internalTransferTotal: transferTotal,
      topCategory: topCategory?.name ?? "Sin datos",
      topCategoryAmount: topCategory?.value ?? 0,
      lastUpdate: lastImport?.createdAt?.toISOString() ?? null,
      uncategorizedCount: uncategorizedTransactions.length
    },
    details,
    charts: {
      categories,
      monthly: monthly.slice(-12).map((row) => ({ month: monthLabel(row.month), income: Number(row.income.toFixed(2)), expenses: Number(row.netExpenses.toFixed(2)), grossExpenses: Number(row.grossExpenses.toFixed(2)), reimbursements: Number(row.reimbursements.toFixed(2)), savings: Number(row.savings.toFixed(2)), transactions: row.transactions })),
      comparison: monthly.slice(-6).map((row) => ({ month: monthLabel(row.month), gastos: Number(row.netExpenses.toFixed(2)), ingresos: Number(row.income.toFixed(2)) }))
    },
    insights: buildInsights(monthly, categories),
    recommendations: recommendations(categories, monthly, uncategorizedTransactions.length),
    recentImports: recentImports.map((item) => ({ id: item.id, fileName: item.fileName, accountName: item.account.name, createdAt: item.createdAt.toISOString(), insertedRows: item.insertedRows })),
    recentTransactions: transactions.slice(0, 8).map((tx) => ({ id: tx.id, date: tx.date.toISOString(), concept: tx.cleanDescription || tx.concept, amount: toNumber(tx.amount), type: tx.type, category: tx.category?.name ?? "Sin categoría", account: tx.account?.name ?? "Cuenta", isReimbursement: isReimbursement(tx), linkedReimbursementAmount: allocations.get(tx.id) ?? 0 }))
  };
}

export async function recalculateMonthlySummaries(userId: string) {
  await detectAndMarkInternalTransfers(userId);
  const transactions = await prisma.transaction.findMany({ where: { userId }, include: { category: true, reimbursementLinks: { include: { expense: { include: { category: true } } } }, reimbursedByLinks: { include: { reimbursement: { include: { category: true } } } } }, orderBy: { date: "asc" } });
  const monthly = buildMonthlyRows(transactions);
  await prisma.monthlySummary.deleteMany({ where: { userId } });

  for (const row of monthly) {
    const breakdown = [...row.categories.entries()].map(([name, value]) => ({ name, value: Number(value.toFixed(2)) })).sort((a, b) => b.value - a.value);
    const topCategory = breakdown[0]?.name ?? null;
    const insights = buildInsights([row], breakdown.map((item) => ({ ...item, color: "#94a3b8", gross: item.value, reimbursements: 0 })));
    await prisma.monthlySummary.upsert({
      where: { userId_month: { userId, month: monthDate(row.month) } },
      create: { userId, month: monthDate(row.month), income: row.income, expenses: row.netExpenses, savings: row.savings, transactionCount: row.transactions, topCategory, categoryBreakdown: breakdown, insights },
      update: { income: row.income, expenses: row.netExpenses, savings: row.savings, transactionCount: row.transactions, topCategory, categoryBreakdown: breakdown, insights }
    });
  }
  return monthly.length;
}

export async function getAdminStats() {
  const [users, transactionCount, importCount, recentImports, recentSessions] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, name: true, email: true, role: true, createdAt: true, updatedAt: true, lastLoginAt: true, _count: { select: { transactions: true, imports: true } } } }),
    prisma.transaction.count(),
    prisma.importHistory.count(),
    prisma.importHistory.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { user: { select: { name: true, email: true } } } }),
    prisma.session.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { user: { select: { name: true, email: true } } } })
  ]);

  const roleBreakdown = { admins: users.filter((user) => user.role === Role.ADMIN).length, users: users.filter((user) => user.role === Role.USER).length };
  return {
    users,
    metrics: { userCount: users.length, transactionCount, importCount, admins: roleBreakdown.admins, regularUsers: roleBreakdown.users },
    recentActivity: [
      ...recentImports.map((item) => ({ id: `import-${item.id}`, type: "Importación", user: item.user.name, detail: `${item.insertedRows} insertados, ${item.duplicateRows} duplicados`, date: item.createdAt.toISOString() })),
      ...recentSessions.map((item) => ({ id: `session-${item.id}`, type: "Inicio de sesión", user: item.user.name, detail: item.userAgent ?? "Sesión web", date: item.createdAt.toISOString() }))
    ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10)
  };
}