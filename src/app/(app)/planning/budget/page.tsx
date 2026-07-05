import { BudgetBlockType, TransactionType } from "@prisma/client";
import { BudgetManager } from "@/components/budget-manager";
import { getSessionUser } from "@/lib/auth";
import { toNumber } from "@/lib/finance";
import { prisma } from "@/lib/prisma";

function addMonths(date: Date, months: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

function blockProgress(limit: number, actual: number) {
  return { limit, actual, percent: limit > 0 ? Math.round((actual / limit) * 100) : 0, remaining: limit - actual };
}

async function budgetProgress(budget: any) {
  const start = budget.month;
  const end = addMonths(start, 1);
  const transactions = await prisma.transaction.findMany({
    where: {
      userId: budget.userId,
      date: { gte: start, lt: end },
      isInternalTransfer: false,
      type: TransactionType.EXPENSE,
      ...(budget.accountId ? { accountId: budget.accountId } : {})
    },
    include: { reimbursedByLinks: { include: { reimbursement: true } } }
  });
  const categoryBlocks = new Map<string, BudgetBlockType>();
  for (const item of budget.categories) categoryBlocks.set(item.categoryId, item.block);
  const actual = { fixed: 0, variable: 0, extra: 0, savings: 0 };
  for (const tx of transactions) {
    const reimbursements = tx.reimbursedByLinks.reduce((sum, link) => sum + Math.abs(toNumber(link.reimbursement.amount)), 0);
    const value = Math.max(0, Math.abs(toNumber(tx.amount)) - reimbursements);
    const block = tx.categoryId ? categoryBlocks.get(tx.categoryId) : null;
    if (block === BudgetBlockType.FIXED) actual.fixed += value;
    else if (block === BudgetBlockType.EXTRA) actual.extra += value;
    else if (block === BudgetBlockType.SAVINGS) actual.savings += value;
    else if (block === BudgetBlockType.VARIABLE) actual.variable += value;
    else if (tx.isFixedExpense) actual.fixed += value;
    else actual.variable += value;
  }
  const fixed = blockProgress(toNumber(budget.fixedLimit), actual.fixed);
  const variable = blockProgress(toNumber(budget.variableLimit), actual.variable);
  const extra = blockProgress(toNumber(budget.extraLimit), actual.extra);
  const savings = blockProgress(toNumber(budget.savingsGoal), actual.savings);
  const totalLimit = fixed.limit + variable.limit + extra.limit;
  const spent = fixed.actual + variable.actual + extra.actual;
  return { fixed, variable, extra, savings, totalLimit, spent, percent: totalLimit > 0 ? Math.round((spent / totalLimit) * 100) : 0, remaining: totalLimit - spent };
}

export default async function BudgetPage() {
  const session = await getSessionUser();
  if (!session) return null;

  const [budgets, accounts, categories] = await Promise.all([
    prisma.monthlyBudget.findMany({
      where: { userId: session.user.id },
      include: { account: { select: { id: true, name: true } }, categories: { include: { category: { select: { id: true, name: true, color: true } } } } },
      orderBy: [{ month: "desc" }, { createdAt: "desc" }]
    }),
    prisma.account.findMany({ where: { userId: session.user.id, isArchived: false }, select: { id: true, name: true }, orderBy: { createdAt: "asc" } }),
    prisma.category.findMany({ where: { OR: [{ userId: null }, { userId: session.user.id }], isArchived: false }, select: { id: true, name: true, color: true }, orderBy: { name: "asc" } })
  ]);

  const rows = await Promise.all(budgets.map(async (budget) => ({
    id: budget.id,
    month: budget.month.toISOString(),
    accountId: budget.accountId ?? "",
    accountName: budget.account?.name ?? null,
    expectedIncome: toNumber(budget.expectedIncome),
    fixedLimit: toNumber(budget.fixedLimit),
    variableLimit: toNumber(budget.variableLimit),
    extraLimit: toNumber(budget.extraLimit),
    savingsGoal: toNumber(budget.savingsGoal),
    categories: budget.categories.map((item) => ({ block: item.block, categoryId: item.categoryId })),
    progress: await budgetProgress(budget)
  })));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-normal text-foreground">Presupuesto mensual</h1>
        <p className="text-sm text-muted-foreground">Crea límites por mes, cuenta y bloque de gasto. No crea movimientos reales.</p>
      </header>
      <BudgetManager initialBudgets={rows} accounts={accounts} categories={categories} />
    </div>
  );
}
