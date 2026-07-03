import { PlanningManager } from "@/components/planning-manager";
import { getSessionUser } from "@/lib/auth";
import { ensureDefaultAccount, toNumber } from "@/lib/finance";
import { getPlanningGoalProgress } from "@/lib/planning";
import { prisma } from "@/lib/prisma";

function dateInput(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : "";
}

export default async function PlanningPage() {
  const session = await getSessionUser();
  if (!session) {
    return null;
  }

  await ensureDefaultAccount(session.user.id);
  const [goals, progress, accounts, categories] = await Promise.all([
    prisma.planningGoal.findMany({
      where: { userId: session.user.id, status: { not: "ARCHIVED" } },
      include: { categories: true },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }]
    }),
    getPlanningGoalProgress(session.user.id),
    prisma.account.findMany({ where: { userId: session.user.id, isArchived: false }, orderBy: { createdAt: "asc" }, select: { id: true, name: true } }),
    prisma.category.findMany({ where: { OR: [{ userId: null }, { userId: session.user.id }], isArchived: false }, orderBy: { name: "asc" }, select: { id: true, name: true, color: true } })
  ]);

  const progressById = new Map(progress.map((item) => [item.id, item]));
  const preparedGoals = goals.map((goal) => {
    const item = progressById.get(goal.id);
    return {
      id: goal.id,
      name: goal.name,
      type: goal.type,
      targetAmount: toNumber(goal.targetAmount),
      actualAmount: item?.actualAmount ?? 0,
      difference: item?.difference ?? toNumber(goal.targetAmount),
      progressPercent: item?.progressPercent ?? 0,
      period: goal.period,
      periodLabel: item?.periodLabel ?? "Sin periodo",
      periodStart: dateInput(goal.periodStart),
      periodEnd: dateInput(goal.periodEnd),
      accountId: goal.accountId ?? "",
      accountName: item?.accountName ?? null,
      categoryIds: goal.categories.map((category) => category.categoryId),
      categoryNames: item?.categoryNames ?? [],
      color: goal.color ?? "#14b8a6",
      icon: goal.icon ?? "target",
      status: goal.status,
      showInDashboard: goal.showInDashboard,
      hasData: item?.hasData ?? false,
      tone: item?.tone ?? "neutral"
    };
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-normal text-foreground">Planificación</h1>
        <p className="text-sm text-muted-foreground">Crea objetivos personalizados y decide cuáles aparecen en el dashboard.</p>
      </header>
      <PlanningManager initialGoals={preparedGoals} accounts={accounts} categories={categories} />
    </div>
  );
}
