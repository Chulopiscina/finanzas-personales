import { PlanningGoalType, PlanningPeriod, PlanningStatus, TransactionType, type Account, type Category, type PlanningGoal } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/finance";

export type PlanningGoalWithRelations = PlanningGoal & {
  account: Account | null;
  categories: Array<{ category: Category }>;
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
  if (goal.status === PlanningStatus.PAUSED) return "neutral";
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

export async function getPlanningGoalProgress(userId: string, options: { dashboardOnly?: boolean } = {}) {
  const goals = await prisma.planningGoal.findMany({
    where: {
      userId,
      status: { not: PlanningStatus.ARCHIVED },
      ...(options.dashboardOnly ? { showInDashboard: true } : {})
    },
    include: { account: true, categories: { include: { category: true } } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }]
  });

  const results: PlanningGoalProgress[] = [];

  for (const goal of goals) {
    const { start, end, label } = periodRange(goal);
    const categoryIds = goal.categories.map((item) => item.categoryId);
    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        date: { gte: start, lt: end },
        isInternalTransfer: false,
        ...(goal.accountId ? { accountId: goal.accountId } : {}),
        ...(categoryIds.length > 0 ? { categoryId: { in: categoryIds } } : {})
      },
      select: { amount: true, type: true }
    });

    const income = transactions
      .filter((transaction) => transaction.type === TransactionType.INCOME)
      .reduce((sum, transaction) => sum + Math.abs(toNumber(transaction.amount)), 0);
    const expense = transactions
      .filter((transaction) => transaction.type === TransactionType.EXPENSE)
      .reduce((sum, transaction) => sum + Math.abs(toNumber(transaction.amount)), 0);
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
      hasData: transactions.length > 0,
      tone: toneFor(goal, actual, target)
    });
  }

  return results;
}
