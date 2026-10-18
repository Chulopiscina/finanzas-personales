import { Prisma, AccountType, BudgetBlockType, PlanningGoalType, PlanningStatus, RecurringPaymentStatus, Role, type Account, type Category, type Transaction } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/format";
import { daysUntil, nextRecurringPaymentDate } from "@/lib/recurring-payments";
import { accountingType, grossExpense, income, isRefund, refundShares, ledgerTotals, spendingEntries, savingsContribution } from "@/lib/ledger";
import { addMoney, cents, euros, sumMoney } from "@/lib/money";

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

export type DashboardPeriodMode = "calendar" | "payroll";
export type CalendarDashboardPeriod = "last-imported-month" | "last-3-months" | "current-year" | "all";
export type PayrollDashboardPeriod = "payroll-current" | "payroll-last-closed" | "payroll-last-3" | "payroll-all";
export type DashboardPeriod = CalendarDashboardPeriod | PayrollDashboardPeriod;
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
  return grossExpense(tx);
}


function isReimbursement(tx: TransactionWithCategory) {
  return isRefund(tx);
}

function realIncome(tx: TransactionWithCategory) {
  return income(tx);
}

export type DashboardRange = { start: Date | null; end: Date | null; label: string };

function startOfDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDays(date: Date, days: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
}

function longMonthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function shortDateLabel(date: Date) {
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(date);
}

function normalizeText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function isPayrollTransaction(tx: TransactionWithCategory) {
  if (realIncome(tx) <= 0 || tx.isInternalTransfer || isReimbursement(tx)) return false;
  const category = normalizeText(tx.category?.name ?? "");
  const text = normalizeText([tx.concept, tx.cleanDescription, tx.rawDescription, tx.category?.name].filter(Boolean).join(" "));
  const looksLikePayroll = category === "nomina" || /\b(abono de nomina|nomina|nomines)\b/.test(text);
  const excluded = /\b(bizum|reembolso|efectivo|cash|transferencia interna|traspaso)\b/.test(text);
  return looksLikePayroll && !excluded;
}

function payrollCycles(transactions: TransactionWithCategory[]) {
  const starts = [...new Set(transactions.filter(isPayrollTransaction).map((tx) => startOfDay(tx.date).getTime()))]
    .sort((left, right) => left - right)
    .map((time) => new Date(time));

  return starts.map((start, index) => ({ start, end: starts[index + 1] ?? null }));
}

function calendarPeriodRange(period: DashboardPeriod, transactions: TransactionWithCategory[]): DashboardRange {
  if (period === "all") {
    return { start: null, end: null, label: "Todo" };
  }

  const latest = transactions[0]?.date ?? new Date();
  if (period === "current-year") {
    const year = new Date().getUTCFullYear();
    return { start: new Date(Date.UTC(year, 0, 1)), end: new Date(Date.UTC(year + 1, 0, 1)), label: "Mes natural: " + year };
  }

  const latestMonth = startOfMonth(latest);
  if (period === "last-3-months") {
    return { start: addMonths(latestMonth, -2), end: addMonths(latestMonth, 1), label: "Mes natural: últimos 3 meses" };
  }

  return { start: latestMonth, end: addMonths(latestMonth, 1), label: "Mes natural: " + longMonthLabel(monthKey(latestMonth)) };
}

function payrollPeriodRange(period: DashboardPeriod, transactions: TransactionWithCategory[]): DashboardRange {
  const cycles = payrollCycles(transactions);
  if (cycles.length === 0) return { start: null, end: null, label: "Ciclo de nómina: sin nóminas detectadas" };

  const current = cycles.at(-1)!;
  if (period === "payroll-all") {
    return { start: cycles[0].start, end: null, label: "Todos los ciclos de nómina" };
  }

  if (period === "payroll-last-3") {
    const first = cycles[Math.max(0, cycles.length - 3)];
    return { start: first.start, end: null, label: "últimos 3 ciclos de nómina" };
  }

  if (period === "payroll-last-closed") {
    const closed = [...cycles].reverse().find((cycle) => cycle.end !== null);
    if (closed?.end) {
      return { start: closed.start, end: closed.end, label: "Ciclo de nómina: " + shortDateLabel(closed.start) + " - " + shortDateLabel(addDays(closed.end, -1)) };
    }
  }

  return { start: current.start, end: null, label: "Ciclo actual: " + shortDateLabel(current.start) + " - hoy" };
}

function periodRange(period: DashboardPeriod, transactions: TransactionWithCategory[], mode: DashboardPeriodMode = "calendar"): DashboardRange {
  return mode === "payroll" ? payrollPeriodRange(period, transactions) : calendarPeriodRange(period, transactions);
}


function reimbursementAllocation(transactions: TransactionWithCategory[]) {
  const allocations = new Map<string, number>();
  for (const reimbursement of transactions) {
    for (const { expense, amount } of refundShares(reimbursement)) {
      allocations.set(expense.id, addMoney(allocations.get(expense.id) ?? 0, amount));
    }
  }

  return allocations;
}

export function buildMonthlyRows(transactions: TransactionWithCategory[]) {
  const grouped = new Map<string, { month: string; income: number; grossExpenses: number; reimbursements: number; netExpenses: number; savings: number; transactions: number; categories: Map<string, number> }>();

  for (const tx of transactions) {
    const key = monthKey(tx.date);
    const row = grouped.get(key) ?? { month: key, income: 0, grossExpenses: 0, reimbursements: 0, netExpenses: 0, savings: 0, transactions: 0, categories: new Map<string, number>() };
    const income = realIncome(tx);
    const expense = signedExpense(tx);
    const reimbursement = isReimbursement(tx) ? Math.abs(toNumber(tx.amount)) : 0;
    const netExpense = addMoney(expense, -reimbursement);

    row.income = addMoney(row.income, income);
    row.grossExpenses = addMoney(row.grossExpenses, expense);
    row.reimbursements = addMoney(row.reimbursements, reimbursement);
    row.netExpenses = addMoney(row.netExpenses, netExpense);
    row.savings = addMoney(row.savings, income, -netExpense);
    row.transactions += 1;

    for (const entry of spendingEntries(tx)) {
      const category = entry.source.category?.name ?? "Sin categoría";
      row.categories.set(category, addMoney(row.categories.get(category) ?? 0, entry.amount));
    }

    grouped.set(key, row);
  }

  return [...grouped.values()].sort((a, b) => a.month.localeCompare(b.month));
}

export function categoryRows(transactions: TransactionWithCategory[]) {
  const totals = new Map<string, { name: string; value: number; color: string; gross: number; reimbursements: number }>();

  for (const tx of transactions) {
    for (const entry of spendingEntries(tx)) {
      const name = entry.source.category?.name ?? "Sin categoría";
      const current = totals.get(name) ?? { name, value: 0, color: entry.source.category?.color ?? "#94a3b8", gross: 0, reimbursements: 0 };
      current.value = addMoney(current.value, entry.amount);
      current.gross = addMoney(current.gross, Math.max(0, entry.amount));
      current.reimbursements = addMoney(current.reimbursements, -Math.min(0, entry.amount));
      totals.set(name, current);
    }
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


export async function ensureDefaultAccount(userId: string) {
  const existing = await prisma.account.findFirst({ where: { userId }, orderBy: { createdAt: "asc" } });
  if (existing) return existing;
  return prisma.account.upsert({ where: { userId_name: { userId, name: "Cuenta principal" } }, create: { userId, name: "Cuenta principal", type: AccountType.BANK, color: "#14b8a6", icon: "landmark" }, update: {} });
}

export function accountBalance(account: Account, transactions: Array<Pick<Transaction, "accountId" | "amount" | "balance">>) {
  const accountTransactions = transactions.filter((tx) => tx.accountId === account.id);
  const latestWithBalance = accountTransactions.find((tx) => tx.balance !== null);
  if (latestWithBalance?.balance !== null && latestWithBalance?.balance !== undefined) {
    const index = accountTransactions.indexOf(latestWithBalance);
    return addMoney(latestWithBalance.balance, sumMoney(accountTransactions.slice(0, index), (tx) => tx.amount));
  }
  return addMoney(account.initialBalance, sumMoney(accountTransactions, (tx) => tx.amount));
}

export async function getAccountBalances(userId: string, accountIds: string[]) {
  if (!accountIds.length) return [];
  return prisma.$queryRaw<Array<{ id: string; confirmedBalance: Prisma.Decimal | null; confirmedAt: Date | null; currentBalance: Prisma.Decimal }>>(Prisma.sql`
    SELECT a."id", anchor."balance" AS "confirmedBalance", anchor."date" AS "confirmedAt",
      COALESCE(anchor."balance", a."initialBalance") + COALESCE(tail."amount", 0) AS "currentBalance"
    FROM "Account" a
    LEFT JOIN LATERAL (
      SELECT t."id", t."date", t."createdAt", t."balance",
        CASE WHEN t."raw"->>'statementSequence' ~ '^[0-9]{1,7}$' THEN (t."raw"->>'statementSequence')::int ELSE 0 END AS sequence
      FROM "Transaction" t
      WHERE t."userId" = ${userId} AND t."accountId" = a."id" AND t."balance" IS NOT NULL
      ORDER BY t."date" DESC, t."createdAt" DESC, sequence DESC, t."id" DESC LIMIT 1
    ) anchor ON TRUE
    LEFT JOIN LATERAL (
      SELECT SUM(t."amount") AS "amount" FROM "Transaction" t
      WHERE t."userId" = ${userId} AND t."accountId" = a."id"
        AND (anchor."id" IS NULL OR (t."date", t."createdAt", CASE WHEN t."raw"->>'statementSequence' ~ '^[0-9]{1,7}$' THEN (t."raw"->>'statementSequence')::int ELSE 0 END, t."id") > (anchor."date", anchor."createdAt", anchor.sequence, anchor."id"))
    ) tail ON TRUE
    WHERE a."userId" = ${userId} AND a."id" IN (${Prisma.join(accountIds)})
  `);
}

function internalTransferTotal(transactions: TransactionWithCategory[], selectedAccount: Account | null) {
  const internal = transactions.filter((tx) => tx.isInternalTransfer);
  if (selectedAccount) return sumMoney(internal, (tx) => Math.abs(toNumber(tx.amount)));
  const grouped = new Map<string, number>();
  for (const tx of internal) {
    const key = tx.internalTransferGroupId ?? tx.id;
    grouped.set(key, Math.max(grouped.get(key) ?? 0, Math.abs(toNumber(tx.amount))));
  }
  return sumMoney([...grouped.values()], (amount) => amount);
}

type BudgetWithCategories = { accountId: string | null; month: Date; expectedIncome: unknown; fixedLimit: unknown; variableLimit: unknown; extraLimit: unknown; savingsGoal: unknown; categories: Array<{ categoryId: string; block: BudgetBlockType }> };

type BudgetBlockSummary = { limit: number; actual: number; percent: number; remaining: number };

type SavingsPlanningGoal = {
  id: string;
  accountId: string | null;
  targetAmount: unknown;
  period?: string;
  periodStart?: Date | null;
  periodEnd?: Date | null;
  categories: Array<{ categoryId: string }>;
  transactions: Array<{ transactionId: string; includeInternalTransfer: boolean }>;
};

function budgetMonthKey(date: Date) {
  return monthKey(startOfMonth(date));
}

export function rangeIncludesBudgetMonth(month: Date, range: DashboardRange, period: DashboardPeriod) {
  if (period === "all" || period === "payroll-all") return true;
  if (!range.start) return true;
  const monthStart = startOfMonth(month);
  const start = startOfMonth(range.start);
  if (period === "payroll-current" || period === "payroll-last-closed") return budgetMonthKey(monthStart) === budgetMonthKey(start);
  if (period === "payroll-last-3") return monthStart >= start && monthStart < addMonths(start, 3);
  if (!range.end) {
    return budgetMonthKey(monthStart) === budgetMonthKey(start);
  }
  return monthStart >= start && monthStart <= startOfMonth(addDays(range.end, -1));
}

function selectBudgetsForDashboard(budgets: BudgetWithCategories[], selectedAccount: Account | null, range: DashboardRange, period: DashboardPeriod) {
  const inRange = budgets.filter((budget) => rangeIncludesBudgetMonth(budget.month, range, period));
  if (!selectedAccount) return inRange.filter((budget) => budget.accountId === null);

  const grouped = new Map<string, BudgetWithCategories[]>();
  for (const budget of inRange.filter((item) => item.accountId === null || item.accountId === selectedAccount.id)) {
    const key = budgetMonthKey(budget.month);
    grouped.set(key, [...(grouped.get(key) ?? []), budget]);
  }

  return [...grouped.values()].flatMap((items) => {
    const accountSpecific = items.filter((item) => item.accountId === selectedAccount.id);
    return accountSpecific.length > 0 ? accountSpecific : items.filter((item) => item.accountId === null);
  });
}

function blockSummary(limit: number, actual: number): BudgetBlockSummary {
  return {
    limit,
    actual,
    percent: limit > 0 ? Math.round((actual / limit) * 100) : 0,
    remaining: addMoney(limit, -actual)
  };
}

export function buildBudgetSummary(budgets: BudgetWithCategories[], transactions: TransactionWithCategory[]) {
  const selected = budgets;
  const fixedLimit = sumMoney(selected, (budget) => budget.fixedLimit);
  const variableLimit = sumMoney(selected, (budget) => budget.variableLimit);
  const extraLimit = sumMoney(selected, (budget) => budget.extraLimit);
  const savingsGoal = sumMoney(selected, (budget) => budget.savingsGoal);
  const expectedIncome = sumMoney(selected, (budget) => budget.expectedIncome);

  const actual = { fixed: 0, variable: 0, extra: 0, savings: 0 };
  for (const tx of transactions) {
    const budget = selected.find((item) => budgetMonthKey(item.month) === budgetMonthKey(tx.date)) ?? selected[0];
    for (const entry of spendingEntries(tx)) {
      const block = budget?.categories.find((item) => item.categoryId === entry.source.categoryId)?.block;
      const key = block === BudgetBlockType.FIXED ? "fixed" : block === BudgetBlockType.EXTRA ? "extra" : block === BudgetBlockType.SAVINGS ? "savings" : block === BudgetBlockType.VARIABLE ? "variable" : entry.source.isFixedExpense ? "fixed" : "variable";
      actual[key] = addMoney(actual[key], entry.amount);
    }
  }

  const totalLimit = addMoney(fixedLimit, variableLimit, extraLimit);
  const spent = addMoney(actual.fixed, actual.variable, actual.extra);
  return {
    configured: selected.length > 0,
    count: selected.length,
    expectedIncome,
    totalLimit,
    spent,
    percent: totalLimit > 0 ? Math.round((spent / totalLimit) * 100) : 0,
    remaining: addMoney(totalLimit, -spent),
    status: totalLimit <= 0 ? "empty" : spent > totalLimit ? "over" : spent / totalLimit >= 0.85 ? "warning" : "ok",
    blocks: {
      fixed: blockSummary(fixedLimit, actual.fixed),
      variable: blockSummary(variableLimit, actual.variable),
      extra: blockSummary(extraLimit, actual.extra),
      savings: blockSummary(savingsGoal, actual.savings)
    }
  };
}

function periodTargetMultiplier(range: DashboardRange, period: DashboardPeriod, transactions: TransactionWithCategory[]) {
  if (period === "last-3-months" || period === "payroll-last-3") return 3;
  if (period === "current-year") return 12;
  if (period === "payroll-current" || period === "payroll-last-closed") return 1;
  if (period === "all" || period === "payroll-all" || !range.start) {
    const months = new Set(transactions.map((tx) => monthKey(tx.date)));
    return Math.max(1, months.size);
  }

  const inclusiveEnd = range.end ? addDays(range.end, -1) : new Date();
  const startMonth = startOfMonth(range.start);
  const endMonth = startOfMonth(inclusiveEnd);
  const months = (endMonth.getUTCFullYear() - startMonth.getUTCFullYear()) * 12 + endMonth.getUTCMonth() - startMonth.getUTCMonth() + 1;
  return Math.max(1, months);
}

function isSavingsCategory(category: Category | null) {
  return category?.type === "SAVINGS" || normalizeText(category?.name ?? "") === "ahorro";
}

export function buildSavingsGoalSummary(goals: SavingsPlanningGoal[], transactions: TransactionWithCategory[], range: DashboardRange, period: DashboardPeriod, _selectedAccount: Account | null) {
  const multiplier = periodTargetMultiplier(range, period, transactions);
  const targetAmount = euros(goals.reduce((sum, goal) => sum + Math.round(cents(goal.targetAmount) * (goal.period === "ANNUAL" ? multiplier / 12 : goal.period === "CUSTOM" ? 1 : multiplier)), 0));
  const manualTransactions = new Map<string, boolean>();

  for (const goal of goals) {
    for (const item of goal.transactions) {
      manualTransactions.set(item.transactionId, (manualTransactions.get(item.transactionId) ?? false) || item.includeInternalTransfer);
    }
  }

  const included: Array<TransactionWithCategory & { includeInternalTransfer: boolean }> = [];
  const countedTransactions = new Set<string>();
  const matchesGoal = (tx: TransactionWithCategory, effectiveDate = tx.date) => goals.some((goal) => {
    if (goal.accountId && goal.accountId !== tx.accountId) return false;
    if (goal.period === "CUSTOM" && ((goal.periodStart && effectiveDate < goal.periodStart) || (goal.periodEnd && effectiveDate >= addDays(goal.periodEnd, 1)))) return false;
    return goal.transactions.some((item) => item.transactionId === tx.id) || isSavingsCategory(tx.category) || goal.categories.some((item) => item.categoryId === tx.categoryId);
  });

  for (const tx of transactions) {
    if (countedTransactions.has(tx.id)) continue;
    const isManual = manualTransactions.has(tx.id);
    if (!matchesGoal(tx)) continue;
    if (isReimbursement(tx) || realIncome(tx) > 0) continue;

    if (tx.isInternalTransfer) {
      const includeInternalTransfer = manualTransactions.get(tx.id) ?? false;
      if (!isManual || !includeInternalTransfer) continue;
      included.push({ ...tx, includeInternalTransfer: true });
      countedTransactions.add(tx.id);
      continue;
    }

    const expense = signedExpense(tx);
    if (expense <= 0) continue;
    included.push({ ...tx, includeInternalTransfer: false });
    countedTransactions.add(tx.id);
  }

  const refunded = sumMoney(transactions.flatMap((tx) => refundShares(tx).filter(({ expense }) => matchesGoal(expense as TransactionWithCategory, tx.date))), (share) => share.amount);
  const actualAmount = addMoney(savingsContribution(included), -refunded);
  const progressPercent = targetAmount > 0 ? Math.round((actualAmount / targetAmount) * 100) : 0;
  return {
    configured: goals.length > 0,
    count: goals.length,
    targetAmount: Number(targetAmount.toFixed(2)),
    actualAmount: Number(actualAmount.toFixed(2)),
    progressPercent,
    remaining: Number((targetAmount - actualAmount).toFixed(2)),
    movementCount: countedTransactions.size
  };
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
    type: accountingType(tx),
    isInternalTransfer: tx.isInternalTransfer,
    isReimbursement: isReimbursement(tx),
    linkedMovements: [...linkedExpenses, ...linkedReimbursements]
  };
}

export async function getDashboardData(userId: string, accountId?: string | null, period: DashboardPeriod = "last-imported-month", periodMode: DashboardPeriodMode = "calendar", includeDetails = false) {
  await ensureDefaultAccount(userId);
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
  const baseTransactionWhere = { userId, accountId: { in: accountFilter.length ? accountFilter : [""] } };

  const [balances, lastImport, recentImports, recurringPayments, latestTransaction] = await Promise.all([
    getAccountBalances(userId, accountFilter),
    prisma.importHistory.findFirst({ where: { userId, status: "COMPLETED", accountId: { in: accountFilter } }, select: { createdAt: true }, orderBy: { createdAt: "desc" } }),
    prisma.importHistory.findMany({ where: { userId, accountId: { in: accountFilter } }, select: { id: true, fileName: true, createdAt: true, insertedRows: true, account: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.recurringPayment.findMany({
      where: { userId, status: RecurringPaymentStatus.ACTIVE, ...(selectedAccount ? { OR: [{ accountId: selectedAccount.id }, { accountId: null }] } : {}) },
      include: { account: { select: { id: true, name: true } }, category: { select: { id: true, name: true, color: true } } },
      orderBy: [{ nextChargeDate: "asc" }, { createdAt: "desc" }],
    }),
    periodMode === "calendar" ? prisma.transaction.findFirst({ where: baseTransactionWhere, select: { date: true }, orderBy: [{ date: "desc" }, { createdAt: "desc" }] }) : Promise.resolve(null)
  ]);

  let range: DashboardRange;
  if (periodMode === "payroll") {
    const cycleTransactions = await prisma.transaction.findMany({
      where: { ...baseTransactionWhere, amount: { gt: 0 }, isInternalTransfer: false, reimbursementLinks: { none: {} }, OR: [{ category: { type: "INCOME" } }, { concept: { contains: "nom", mode: "insensitive" } }, { cleanDescription: { contains: "nom", mode: "insensitive" } }] },
      select: {
        id: true,
        date: true,
        concept: true,
        cleanDescription: true,
        rawDescription: true,
        amount: true,
        type: true,
        isInternalTransfer: true,
        category: true,
        reimbursementLinks: { select: { expenseId: true } }
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }]
    });
    range = periodRange(period, cycleTransactions as unknown as TransactionWithCategory[], periodMode);
  } else {
    range = periodRange(period, latestTransaction ? ([latestTransaction] as unknown as TransactionWithCategory[]) : [], periodMode);
  }

  const dateFilter = range.start || range.end ? { date: { ...(range.start ? { gte: range.start } : {}), ...(range.end ? { lt: range.end } : {}) } } : {};
  const transactions = await prisma.transaction.findMany({
    where: { ...baseTransactionWhere, ...dateFilter },
    select: {
      id: true, date: true, amount: true, balance: true, type: true, categoryId: true, accountId: true,
      isInternalTransfer: true, isFixedExpense: true, internalTransferGroupId: true,
      concept: true, cleanDescription: true, rawDescription: true,
      ...transactionInclude
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }]
  }) as unknown as TransactionWithCategory[];
  const budgetCandidates = await prisma.monthlyBudget.findMany({
    where: { userId, ...(selectedAccount ? { OR: [{ accountId: selectedAccount.id }, { accountId: null }] } : { accountId: null }) },
    include: { categories: true, account: { select: { id: true, name: true } } },
    orderBy: [{ month: "asc" }, { createdAt: "asc" }]
  });
  const savingsGoals = await prisma.planningGoal.findMany({
    where: {
      userId,
      type: PlanningGoalType.SAVINGS,
      status: PlanningStatus.ACTIVE,
      ...(selectedAccount ? { OR: [{ accountId: selectedAccount.id }, { accountId: null }] } : {})
    },
    select: {
      id: true,
      accountId: true,
      targetAmount: true,
      period: true,
      periodStart: true,
      periodEnd: true,
      categories: { select: { categoryId: true } },
      transactions: { select: { transactionId: true, includeInternalTransfer: true } }
    },
    orderBy: { createdAt: "desc" }
  });
  const allocations = reimbursementAllocation(transactions);
  const budgetSummary = buildBudgetSummary(selectBudgetsForDashboard(budgetCandidates, selectedAccount, range, period), transactions);
  const savingsGoalSummary = buildSavingsGoalSummary(savingsGoals, transactions, range, period, selectedAccount);
  const incomeTransactions = transactions.filter((tx) => realIncome(tx) > 0);
  const expenseTransactions = transactions.filter((tx) => signedExpense(tx) > 0);
  const reimbursementTransactions = transactions.filter(isReimbursement);
  const internalTransactions = transactions.filter((tx) => tx.isInternalTransfer);
  const uncategorizedTransactions = transactions.filter((tx) => !tx.categoryId && !tx.isInternalTransfer);

  const { income: totalIncome, grossExpenses, reimbursements, netExpenses, result } = ledgerTotals(transactions);
  const fixedExpenses = sumMoney(expenseTransactions.filter((tx) => tx.isFixedExpense), signedExpense);
  const variableExpenses = sumMoney(expenseTransactions.filter((tx) => !tx.isFixedExpense), signedExpense);
  const currentBalance = sumMoney(balances, (row) => row.currentBalance);
  const transferTotal = internalTransferTotal(transactions, selectedAccount);
  const monthly = buildMonthlyRows(transactions);
  const categories = categoryRows(transactions);
  const averageMonthlyExpense = monthly.length > 0 ? euros(Math.round(cents(netExpenses) / periodTargetMultiplier(range, period, transactions))) : 0;
  const currentMonthSavings = monthly.at(-1)?.savings ?? 0;
  const topCategory = categories.find((category) => category.value > 0) ?? null;
  const topCategoryTransactions = topCategory ? expenseTransactions.filter((tx) => (tx.category?.name ?? "Sin categoría") === topCategory.name) : [];
  const upcomingPayments = recurringPayments
    .map((payment) => {
      const projected = nextRecurringPaymentDate(payment.nextChargeDate, payment.frequency);
      if (!projected) return null;
      return {
        id: payment.id,
        name: payment.name,
        amount: toNumber(payment.amount),
        date: projected.toISOString(),
        accountName: payment.account?.name ?? "Sin cuenta",
        categoryName: payment.category?.name ?? null,
        daysUntil: daysUntil(projected)
      };
    })
    .filter((payment): payment is NonNullable<typeof payment> => Boolean(payment))
    .sort((left, right) => left.date.localeCompare(right.date))
    .slice(0, 5);

  const netExpenseDetailIds = new Set([...expenseTransactions.map((tx) => tx.id), ...reimbursementTransactions.map((tx) => tx.id)]);
  const details: Record<DashboardDetailKey, ReturnType<typeof detailRow>[]> = includeDetails ? {
    realIncome: incomeTransactions.map(detailRow),
    grossExpenses: expenseTransactions.map(detailRow),
    reimbursements: reimbursementTransactions.map(detailRow),
    netExpenses: transactions.filter((tx) => netExpenseDetailIds.has(tx.id)).map(detailRow),
    periodResult: [...incomeTransactions, ...expenseTransactions, ...reimbursementTransactions].map(detailRow),
    internalTransfers: internalTransactions.map(detailRow),
    topCategory: topCategoryTransactions.map(detailRow),
    uncategorized: uncategorizedTransactions.map(detailRow),
    averageMonthlyNetExpense: transactions.filter((tx) => netExpenseDetailIds.has(tx.id)).map(detailRow)
  } : { realIncome: [], grossExpenses: [], reimbursements: [], netExpenses: [], periodResult: [], internalTransfers: [], topCategory: [], uncategorized: [], averageMonthlyNetExpense: [] };

  return {
    period,
    periodMode,
    periodLabel: range.label,
    targetMultiplier: periodTargetMultiplier(range, period, transactions),
    range: { start: range.start?.toISOString() ?? null, end: range.end?.toISOString() ?? null, label: range.label },
    balanceStatus: balances.some((row) => row.confirmedBalance === null) ? "calculado" : "saldo bancario y movimientos posteriores",
    accounts: accounts.map((account) => ({ id: account.id, name: account.name, isArchived: account.isArchived, color: account.color, type: account.type })),
    selectedAccount: selectedAccount ? { id: selectedAccount.id, name: selectedAccount.name, color: selectedAccount.color, type: selectedAccount.type } : null,
    metrics: {
      currentBalance,
      totalIncome,
      totalExpenses: grossExpenses,
      grossExpenses,
      fixedExpenses,
      variableExpenses,
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
    budget: budgetSummary,
    savingsGoal: savingsGoalSummary,
    details,
    charts: {
      categories,
      monthly: monthly.slice(-12).map((row) => ({ month: monthLabel(row.month), income: Number(row.income.toFixed(2)), expenses: Number(row.netExpenses.toFixed(2)), grossExpenses: Number(row.grossExpenses.toFixed(2)), reimbursements: Number(row.reimbursements.toFixed(2)), savings: Number(row.savings.toFixed(2)), transactions: row.transactions })),
      comparison: monthly.slice(-6).map((row) => ({ month: monthLabel(row.month), gastos: Number(row.netExpenses.toFixed(2)), ingresos: Number(row.income.toFixed(2)) }))
    },
    insights: buildInsights(monthly, categories),
    recommendations: recommendations(categories, monthly, uncategorizedTransactions.length),
    recentImports: recentImports.map((item) => ({ id: item.id, fileName: item.fileName, accountName: item.account.name, createdAt: item.createdAt.toISOString(), insertedRows: item.insertedRows })),
    upcomingPayments,
    recentTransactions: transactions.slice(0, 8).map((tx) => ({ id: tx.id, date: tx.date.toISOString(), concept: tx.cleanDescription || tx.concept, amount: toNumber(tx.amount), type: accountingType(tx), category: tx.category?.name ?? "Sin categoría", account: tx.account?.name ?? "Cuenta", isReimbursement: isReimbursement(tx), linkedReimbursementAmount: allocations.get(tx.id) ?? 0 }))
  };
}

export async function recalculateMonthlySummaries(userId: string) {
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
