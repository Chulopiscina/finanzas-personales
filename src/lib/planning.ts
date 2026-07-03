import { PlanningGoalType, PlanningPeriod, PlanningStatus, TransactionType, type Account, type Category, type PlanningGoal } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/finance";

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

function customRange(goal: PlanningGoalWithRelations) {
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

function periodRange(goal: PlanningGoalWithRelations) {
  if (goal.period === PlanningPeriod.ANNUAL) return annualRange();
  if (goal.period === PlanningPeriod.CUSTOM) return customRange(goal);
  return monthRange();
}

function isExpenseGoal(type: PlanningGoalType) {
  return type === PlanningGoalType.FIXED_EXPENSE || type === PlanningGoalType.VARIABLE_EXPENSE || type === PlanningGoalType.DEBT || type === PlanningGoalType.OTHER;
}

function toneFor(goal: PlanningGoalWithRelations, actual: number, target: number) {
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

function inRange(date: Date, start: Date, end: Date) {
  return date >= start && date < end;
}

function movementSource(isAutomatic: boolean, isManual: boolean): PlanningGoalMovement["source"] {
  if (isAutomatic && isManual) return "both";
  return isManual ? "manual" : "automatic";
}

function shouldCountMovement(movement: PlanningGoalMovement) {
  return !movement.isInternalTransfer || movement.includeInternalTransfer;
}

function movementAmounts(movements: PlanningGoalMovement[]) {
  return movements.filter(shouldCountMovement).reduce(
    (totals, movement) => {
      if (movement.type === TransactionType.INCOME || (movement.isInternalTransfer && movement.includeInternalTransfer && movement.amount > 0)) {
        totals.income += Math.abs(movement.amount);
      }
      if (movement.type === TransactionType.EXPENSE || (movement.isInternalTransfer && movement.includeInternalTransfer && movement.amount < 0)) {
        totals.expense += Math.abs(movement.amount);
      }
      return totals;
    },
    { income: 0, expense: 0 }
  );
}

export async function getPlanningGoalProgress(userId: string, options: { dashboardOnly?: boolean; includeArchived?: boolean } = {}) {
  const goals = await prisma.planningGoal.findMany({
    where: {
      userId,
      ...(options.includeArchived ? {} : { status: { not: PlanningStatus.ARCHIVED } }),
      ...(options.dashboardOnly ? { showInDashboard: true } : {})
    },
    include: {
      account: true,
      categories: { include: { category: true } },
      transactions: {
        include: {
          transaction: {
            select: {
              id: true,
              date: true,
              concept: true,
              cleanDescription: true,
              amount: true,
              type: true,
              isInternalTransfer: true,
              account: { select: { name: true } },
              category: { select: { name: true } }
            }
          }
        }
      }
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }]
  });

  const results: PlanningGoalProgress[] = [];

  for (const goal of goals) {
    const { start, end, label } = periodRange(goal);
    const categoryIds = goal.categories.map((item) => item.categoryId);
    const automaticTransactions = categoryIds.length > 0
      ? await prisma.transaction.findMany({
          where: {
            userId,
            date: { gte: start, lt: end },
            isInternalTransfer: false,
            ...(goal.accountId ? { accountId: goal.accountId } : {}),
            categoryId: { in: categoryIds }
          },
          select: {
            id: true,
            date: true,
            concept: true,
            cleanDescription: true,
            amount: true,
            type: true,
            isInternalTransfer: true,
            account: { select: { name: true } },
            category: { select: { name: true } }
          }
        })
      : [];

    const movementMap = new Map<string, PlanningGoalMovement>();

    for (const transaction of automaticTransactions) {
      movementMap.set(transaction.id, {
        id: transaction.id,
        date: transaction.date.toISOString(),
        concept: transaction.cleanDescription ?? transaction.concept,
        amount: toNumber(transaction.amount),
        type: transaction.type,
        accountName: transaction.account?.name ?? null,
        categoryName: transaction.category?.name ?? null,
        source: "automatic",
        isManual: false,
        isAutomatic: true,
        isInternalTransfer: transaction.isInternalTransfer,
        includeInternalTransfer: false,
        countsInProgress: true
      });
    }

    for (const manual of goal.transactions) {
      const transaction = manual.transaction;
      if (!inRange(transaction.date, start, end)) continue;
      const existing = movementMap.get(transaction.id);
      const includeInternalTransfer = manual.includeInternalTransfer;
      const base = existing ?? {
        id: transaction.id,
        date: transaction.date.toISOString(),
        concept: transaction.cleanDescription ?? transaction.concept,
        amount: toNumber(transaction.amount),
        type: transaction.type,
        accountName: transaction.account?.name ?? null,
        categoryName: transaction.category?.name ?? null,
        source: "manual" as const,
        isManual: false,
        isAutomatic: false,
        isInternalTransfer: transaction.isInternalTransfer,
        includeInternalTransfer,
        countsInProgress: false
      };

      const next = {
        ...base,
        source: movementSource(base.isAutomatic, true),
        isManual: true,
        includeInternalTransfer: base.includeInternalTransfer || includeInternalTransfer
      };
      next.countsInProgress = shouldCountMovement(next);
      movementMap.set(transaction.id, next);
    }

    const movements = [...movementMap.values()].sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime());
    const countedMovements = movements.filter((movement) => movement.countsInProgress);
    const { income, expense } = movementAmounts(movements);
    const target = toNumber(goal.targetAmount);
    const actual = isExpenseGoal(goal.type) ? expense : income - expense;
    const progress = target > 0 ? Math.max(0, Math.min(150, (actual / target) * 100)) : 0;

    results.push({
      id: goal.id,
      name: goal.name,
      type: goal.type,
      period: goal.period,
      targetAmount: target,
      actualAmount: Number(actual.toFixed(2)),
      difference: Number((target - actual).toFixed(2)),
      progressPercent: Number(progress.toFixed(0)),
      status: goal.status,
      showInDashboard: goal.showInDashboard,
      color: goal.color,
      icon: goal.icon,
      accountName: goal.account?.name ?? null,
      categoryNames: goal.categories.map((item) => item.category.name),
      periodLabel: label,
      hasData: countedMovements.length > 0,
      automaticMovementCount: movements.filter((movement) => movement.isAutomatic).length,
      manualMovementCount: movements.filter((movement) => movement.isManual).length,
      movements,
      tone: toneFor(goal, actual, target)
    });
  }

  return results;
}