import { PlanningGoalType, PlanningPeriod, PlanningStatus, TransactionType, type Account, type Category, type PlanningGoal } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/finance";
import { accountingType, spendingEntries } from "@/lib/ledger";
import { addMoney, cents, euros } from "@/lib/money";

export type PlanningGoalWithRelations = PlanningGoal & {
  account: Account | null;
  categories: Array<{ categoryId: string; category: Category }>;
  transactions: Array<{
    includeInternalTransfer: boolean;
    transaction: {
      id: string;
      date: Date;
      concept: string;
      cleanDescription: string | null;
      amount: unknown;
      type: TransactionType;
      isInternalTransfer: boolean;
      account: { name: string } | null;
      category: { name: string } | null;
    };
  }>;
};

export type PlanningGoalMovement = {
  id: string;
  date: string;
  concept: string;
  amount: number;
  type: TransactionType;
  accountName: string | null;
  categoryName: string | null;
  source: "automatic" | "manual" | "both";
  isManual: boolean;
  isAutomatic: boolean;
  isInternalTransfer: boolean;
  includeInternalTransfer: boolean;
  countsInProgress: boolean;
};

export type PlanningGoalProgress = {
  id: string;
  name: string;
  type: PlanningGoalType;
  period: PlanningPeriod;
  targetAmount: number;
  actualAmount: number;
  difference: number;
  progressPercent: number;
  status: PlanningStatus;
  showInDashboard: boolean;
  color: string | null;
  icon: string | null;
  accountName: string | null;
  categoryNames: string[];
  periodLabel: string;
  hasData: boolean;
  automaticMovementCount: number;
  manualMovementCount: number;
  movements: PlanningGoalMovement[];
  tone: "success" | "warning" | "danger" | "neutral";
};

export const planningTypeLabels: Record<PlanningGoalType, string> = {
  FIXED_EXPENSE: "Gasto fijo",
  VARIABLE_EXPENSE: "Gasto variable",
  SAVINGS: "Ahorro",
  INVESTMENT: "Inversión",
  DEBT: "Deuda",
  OTHER: "Otro"
};

export const planningPeriodLabels: Record<PlanningPeriod, string> = {
  MONTHLY: "Mensual",
  ANNUAL: "Anual",
  CUSTOM: "Personalizado"
};

function monthRange(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, end, label: "Mes actual" };
}

function annualRange(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear() + 1, 0, 1));
  return { start, end, label: String(now.getUTCFullYear()) };
}

function customRange(goal: Pick<PlanningGoal, "periodStart" | "periodEnd">) {
  if (goal.periodStart && goal.periodEnd && goal.periodEnd > goal.periodStart) {
    const formatter = new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric" });
    return {
      start: goal.periodStart,
      end: new Date(goal.periodEnd.getTime() + 86_400_000),
      label: `${formatter.format(goal.periodStart)} - ${formatter.format(goal.periodEnd)}`
    };
  }

  return monthRange();
}

function periodRange(goal: PlanningGoal) {
  if (goal.period === PlanningPeriod.ANNUAL) return annualRange();
  if (goal.period === PlanningPeriod.CUSTOM) return customRange(goal);
  return monthRange();
}

function isExpenseGoal(type: PlanningGoalType) {
  return type === PlanningGoalType.FIXED_EXPENSE || type === PlanningGoalType.VARIABLE_EXPENSE || type === PlanningGoalType.DEBT || type === PlanningGoalType.OTHER;
}

function toneFor(goal: Pick<PlanningGoal, "status" | "type">, actual: number, target: number) {
  if (goal.status === PlanningStatus.PAUSED || goal.status === PlanningStatus.ARCHIVED) return "neutral";
  if (goal.status === PlanningStatus.COMPLETED) return "success";
  if (target <= 0) return "neutral";

  const ratio = actual / target;
  if (isExpenseGoal(goal.type)) {
    if (ratio > 1) return "danger";
    if (ratio >= 0.8) return "warning";
    return "success";
  }

  if (ratio >= 1) return "success";
  if (ratio >= 0.6) return "warning";
  return "neutral";
}


function movementSource(isAutomatic: boolean, isManual: boolean): PlanningGoalMovement["source"] {
  if (isAutomatic && isManual) return "both";
  return isManual ? "manual" : "automatic";
}


export async function getPlanningGoalProgress(userId: string, options: {
  dashboardOnly?: boolean; includeArchived?: boolean; accountId?: string;
  range?: { start: Date | null; end: Date | null; label: string }; targetMultiplier?: number;
} = {}) {
  const goals = await prisma.planningGoal.findMany({
    where: { userId, ...(options.includeArchived ? {} : { status: { not: PlanningStatus.ARCHIVED } }),
      ...(options.dashboardOnly ? { showInDashboard: true, status: PlanningStatus.ACTIVE } : {}),
      ...(options.accountId ? { OR: [{ accountId: options.accountId }, { accountId: null }] } : {}) },
    include: { account: true, categories: { include: { category: true } },
      transactions: { select: { transactionId: true, includeInternalTransfer: true } } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }]
  });
  if (!goals.length) return [];
  const ranges = goals.map((goal) => options.range ?? periodRange(goal));
  const starts = ranges.map((range) => range.start?.getTime()).filter((date): date is number => date !== undefined);
  const ends = ranges.map((range) => range.end?.getTime()).filter((date): date is number => date !== undefined);
  const categories = [...new Set(goals.flatMap((goal) => goal.categories.map((item) => item.categoryId)))];
  const transactions = await prisma.transaction.findMany({
    where: { userId, ...(options.accountId ? { accountId: options.accountId } : {}), ...(options.dashboardOnly ? { account: { isArchived: false } } : {}),
      date: { ...(starts.length === ranges.length ? { gte: new Date(Math.min(...starts)) } : {}), ...(ends.length === ranges.length ? { lt: new Date(Math.max(...ends)) } : {}) },
      OR: [{ categoryId: { in: categories } }, { planningGoals: { some: { goalId: { in: goals.map((goal) => goal.id) } } } },
        { reimbursementLinks: { some: { expense: { OR: [{ categoryId: { in: categories } }, { planningGoals: { some: { goalId: { in: goals.map((goal) => goal.id) } } } }] } } } }] },
    include: { category: true, account: { select: { name: true } },
      reimbursementLinks: { include: { expense: { include: { category: true } } } } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }, { id: "desc" }]
  });
  return goals.map((goal, index): PlanningGoalProgress => {
    const range = ranges[index];
    const categoryIds = new Set(goal.categories.map((item) => item.categoryId));
    const manual = new Map(goal.transactions.map((item) => [item.transactionId, item.includeInternalTransfer]));
    const movements: PlanningGoalMovement[] = [];
    const groups = new Set<string>();
    let actualCents = 0;
    for (const tx of transactions) {
      if ((range.start && tx.date < range.start) || (range.end && tx.date >= range.end) || (goal.accountId && tx.accountId !== goal.accountId)) continue;
      if (goal.period === PlanningPeriod.CUSTOM && ((goal.periodStart && tx.date < goal.periodStart) || (goal.periodEnd && tx.date >= new Date(goal.periodEnd.getTime() + 86_400_000)))) continue;
      const isManual = manual.has(tx.id);
      const entries = spendingEntries(tx).filter((entry) => isManual || manual.has(entry.source.id) || categoryIds.has(entry.source.categoryId ?? ""));
      const automatic = !tx.isInternalTransfer && (categoryIds.has(tx.categoryId ?? "") || entries.length > 0);
      if (!automatic && !isManual) continue;
      const includeInternalTransfer = manual.get(tx.id) === true;
      const counts = !tx.isInternalTransfer || includeInternalTransfer;
      if (counts) {
        if (tx.isInternalTransfer) {
          const key = tx.internalTransferGroupId ?? tx.id;
          if (!groups.has(key)) actualCents += Math.abs(cents(tx.amount));
          groups.add(key);
        } else {
          actualCents += entries.reduce((sum, entry) => sum + cents(entry.amount), 0);
        }
      }
      movements.push({ id: tx.id, date: tx.date.toISOString(), concept: tx.cleanDescription || tx.concept, amount: toNumber(tx.amount),
        type: accountingType(tx), accountName: tx.account?.name ?? null, categoryName: tx.category?.name ?? null,
        source: movementSource(automatic, isManual), isManual, isAutomatic: automatic, isInternalTransfer: tx.isInternalTransfer,
        includeInternalTransfer, countsInProgress: counts });
    }
    const months = options.targetMultiplier ?? 1;
    const target = options.range
      ? euros(Math.round(cents(goal.targetAmount) * (goal.period === "ANNUAL" ? months / 12 : goal.period === "CUSTOM" ? 1 : months)))
      : toNumber(goal.targetAmount);
    const actual = euros(actualCents);
    return { id: goal.id, name: goal.name, type: goal.type, period: goal.period, targetAmount: target, actualAmount: actual,
      difference: addMoney(target, -actual), progressPercent: target > 0 ? Math.round(actual / target * 100) : 0,
      status: goal.status, showInDashboard: goal.showInDashboard, color: goal.color, icon: goal.icon,
      accountName: goal.account?.name ?? null, categoryNames: goal.categories.map((item) => item.category.name), periodLabel: range.label,
      hasData: movements.some((item) => item.countsInProgress), automaticMovementCount: movements.filter((item) => item.isAutomatic).length,
      manualMovementCount: movements.filter((item) => item.isManual).length, movements, tone: toneFor(goal, actual, target) };
  });
}
