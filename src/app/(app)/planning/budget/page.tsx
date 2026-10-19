import { BudgetManager } from "@/components/budget-manager";
import { getSessionUser } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { PlanningNavigation } from "@/components/planning-navigation";
import { buildBudgetSummary, toNumber } from "@/lib/finance";
import { prisma } from "@/lib/prisma";

function addMonths(date: Date, months: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}


function budgetProgress(budget: Parameters<typeof buildBudgetSummary>[0][number], transactions: Parameters<typeof buildBudgetSummary>[1]) {
  const rows = transactions.filter((tx) => tx.date >= budget.month && tx.date < addMonths(budget.month, 1) && (!budget.accountId || budget.accountId === tx.accountId));
  const summary = buildBudgetSummary([budget], rows);
  return { ...summary.blocks, totalLimit: summary.totalLimit, spent: summary.spent, percent: summary.percent, remaining: summary.remaining };
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

  const transactions = budgets.length ? await prisma.transaction.findMany({
    where: { userId: session.user.id, accountId: { in: accounts.map((account) => account.id) }, date: { gte: budgets.at(-1)!.month, lt: addMonths(budgets[0].month, 1) } },
    include: { category: true, reimbursementLinks: { include: { expense: { include: { category: true } } } } }
  }) : [];
  const rows = budgets.map((budget) => ({
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
    progress: budgetProgress(budget, transactions)
  }));

  return (
    <div className="space-y-6">
      <PageHeader title="Presupuesto mensual" description="Decide cuánto gastar y sigue tu progreso mes a mes." />
      <PlanningNavigation />
      <BudgetManager initialBudgets={rows} accounts={accounts} categories={categories} />
    </div>
  );
}
