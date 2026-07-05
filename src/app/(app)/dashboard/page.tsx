import { Role } from "@prisma/client";
import { DashboardAccountSelector } from "@/components/dashboard-account-selector";
import { DashboardCharts } from "@/components/dashboard-charts";
import { DashboardMetrics } from "@/components/dashboard-metrics";
import { DashboardPeriodSelector } from "@/components/dashboard-period-selector";
import { getAuthorizedUserId, getSessionUser } from "@/lib/auth";
import { formatCurrency } from "@/lib/format";
import { type DashboardPeriod, type DashboardPeriodMode, getDashboardData } from "@/lib/finance";
import { getPlanningGoalProgress } from "@/lib/planning";
import { prisma } from "@/lib/prisma";

type Props = {
  searchParams?: Promise<{ userId?: string; accountId?: string; period?: string; periodMode?: string }>;
};

const calendarPeriods: DashboardPeriod[] = ["last-imported-month", "last-3-months", "current-year", "all"];
const payrollPeriods: DashboardPeriod[] = ["payroll-current", "payroll-last-closed", "payroll-last-3", "payroll-all"];

function parsePeriodMode(value?: string): DashboardPeriodMode {
  return value === "payroll" ? "payroll" : "calendar";
}

function parsePeriod(value: string | undefined, mode: DashboardPeriodMode): DashboardPeriod {
  const validPeriods = mode === "payroll" ? payrollPeriods : calendarPeriods;
  return validPeriods.includes(value as DashboardPeriod) ? (value as DashboardPeriod) : validPeriods[0];
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || "Oriol";
}

export default async function DashboardPage({ searchParams }: Props) {
  const session = await getSessionUser();
  if (!session) return null;

  const params = await searchParams;
  const periodMode = parsePeriodMode(params?.periodMode);
  const period = parsePeriod(params?.period, periodMode);
  const userId = getAuthorizedUserId(session.user, params?.userId);
  const [data, owner, planningGoals] = await Promise.all([
    getDashboardData(userId, params?.accountId, period, periodMode),
    userId !== session.user.id && session.user.role === Role.ADMIN ? prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } }) : null,
    getPlanningGoalProgress(userId, { dashboardOnly: true })
  ]);

  const displayName = owner?.name ?? session.user.name;
  const scopeLabel = owner ? owner.email : data.selectedAccount ? data.selectedAccount.name : "Todas las cuentas";
  const periodResult = data.metrics.periodResult;
  const resultCopy = periodResult >= 0
    ? `Este periodo vas en positivo con ${formatCurrency(periodResult)}.`
    : `Este periodo llevas ${formatCurrency(Math.abs(periodResult))} más de gasto neto que ingresos.`;

  return (
    <div className="space-y-10">
      <header className="grid gap-6 xl:grid-cols-[1fr_auto] xl:items-center">
        <div className="min-w-0 space-y-2">
          <h1 className="text-3xl font-semibold tracking-normal text-foreground sm:text-4xl">Hola {firstName(displayName)} 👋</h1>
          <p className="max-w-2xl text-base text-muted-foreground">{resultCopy}</p>
          <p className="text-sm text-muted-foreground">{scopeLabel} · {data.periodLabel}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center xl:justify-end">
          <DashboardPeriodSelector period={period} periodMode={periodMode} />
          <DashboardAccountSelector accounts={data.accounts} selectedAccountId={data.selectedAccount?.id ?? null} />
        </div>
      </header>

      <DashboardMetrics data={data} />

      {planningGoals.length > 0 ? (
        <section className="rounded-2xl border border-border bg-card p-5 shadow-[0_12px_30px_rgba(15,23,42,0.04)] dark:shadow-none">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-card-foreground">Planificación</h2>
            <span className="text-xs text-muted-foreground">{planningGoals.length} visibles</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {planningGoals.map((goal) => (
              <article key={goal.id} className="rounded-2xl border border-border bg-background p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(15,23,42,0.05)] dark:bg-muted/20 dark:shadow-none">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-card-foreground">{goal.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{goal.periodLabel}{goal.accountName ? ` · ${goal.accountName}` : ""}</p>
                  </div>
                  <span className={goal.tone === "success" ? "text-xs font-medium text-success" : goal.tone === "danger" ? "text-xs font-medium text-danger" : goal.tone === "warning" ? "text-xs font-medium text-warning" : "text-xs font-medium text-muted-foreground"}>{goal.progressPercent} %</span>
                </div>
                <div className="mt-4 h-2 rounded-full bg-muted">
                  <div className="h-full rounded-full bg-accent transition-all duration-200" style={{ width: `${Math.max(0, Math.min(100, goal.progressPercent))}%`, backgroundColor: goal.color ?? undefined }} />
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">{formatCurrency(goal.actualAmount)}</span>
                  <span className="font-medium text-card-foreground">{formatCurrency(goal.targetAmount)}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Gráficos</h2>
            <p className="text-sm text-muted-foreground">Resumen visual del periodo seleccionado.</p>
          </div>
        </div>
        <DashboardCharts categories={data.charts.categories} monthly={data.charts.monthly} comparison={data.charts.comparison} />
      </section>
    </div>
  );
}
