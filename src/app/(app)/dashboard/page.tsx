import { Role } from "@prisma/client";
import { DashboardAccountSelector } from "@/components/dashboard-account-selector";
import { DashboardChartsLazy } from "@/components/dashboard-charts-lazy";
import {
  DashboardMetrics,
  DashboardPlanning,
} from "@/components/dashboard-metrics";
import { DashboardPeriodSelector } from "@/components/dashboard-period-selector";
import { getAuthorizedUserId, getSessionUser } from "@/lib/auth";
import { formatCurrency } from "@/lib/format";
import {
  type DashboardPeriod,
  type DashboardPeriodMode,
  getDashboardData,
} from "@/lib/finance";
import { prisma } from "@/lib/prisma";

type Props = {
  searchParams?: Promise<{
    userId?: string;
    accountId?: string;
    period?: string;
    periodMode?: string;
  }>;
};

const calendarPeriods: DashboardPeriod[] = [
  "last-imported-month",
  "last-3-months",
  "current-year",
  "all",
];
const payrollPeriods: DashboardPeriod[] = [
  "payroll-current",
  "payroll-last-closed",
  "payroll-last-3",
  "payroll-all",
];

function parsePeriodMode(value?: string): DashboardPeriodMode {
  return value === "payroll" ? "payroll" : "calendar";
}

function parsePeriod(
  value: string | undefined,
  mode: DashboardPeriodMode,
): DashboardPeriod {
  const validPeriods = mode === "payroll" ? payrollPeriods : calendarPeriods;
  return validPeriods.includes(value as DashboardPeriod)
    ? (value as DashboardPeriod)
    : validPeriods[0];
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
  const [data, owner] = await Promise.all([
    getDashboardData(userId, params?.accountId, period, periodMode),
    userId !== session.user.id && session.user.role === Role.ADMIN
      ? prisma.user.findUnique({
          where: { id: userId },
          select: { name: true, email: true },
        })
      : null,
  ]);
  const planningGoals = data.planning;

  const displayName = owner?.name ?? session.user.name;
  const scopeLabel = owner
    ? owner.email
    : data.selectedAccount
      ? data.selectedAccount.name
      : "Todas las cuentas";
  const periodResult = data.metrics.periodResult;
  const resultCopy =
    periodResult >= 0
      ? `Este periodo vas en positivo con ${formatCurrency(periodResult)}.`
      : `Este periodo llevas ${formatCurrency(Math.abs(periodResult))} más de gasto neto que ingresos.`;

  return (
    <div className="space-y-6 sm:space-y-7">
      <header className="space-y-6">
        <div className="min-w-0 space-y-2">
          <p className="eyebrow">Tu dinero, en perspectiva</p>
          <h1 className="page-title">Hola {firstName(displayName)}</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {resultCopy}
          </p>
        </div>
        <div className="flex flex-col gap-3 border-y border-border py-4 xl:flex-row xl:items-center xl:justify-between">
          <p className="text-xs text-muted-foreground">
            {scopeLabel} · {data.periodLabel}
          </p>
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
            <DashboardPeriodSelector period={period} periodMode={periodMode} />
            <DashboardAccountSelector
              accounts={data.accounts}
              selectedAccountId={data.selectedAccount?.id ?? null}
            />
          </div>
        </div>
      </header>

      <DashboardMetrics data={data} />

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Tu planificación</h2>
        <DashboardPlanning data={data} />
      </section>

      <section className="space-y-4" aria-label="Análisis financiero">
        <div className="flex items-end justify-between">
          <h2 className="text-lg font-semibold">Gráficos</h2>
          <p className="text-xs text-muted-foreground">
            {data.metrics.transactionCount} movimientos
          </p>
        </div>
        <DashboardChartsLazy
          categories={data.charts.categories}
          monthly={data.charts.monthly}
          comparison={data.charts.comparison}
        />
      </section>

      {planningGoals.length > 0 ? (
        <section className="border-t border-border pt-5">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-card-foreground">
              Planificación
            </h2>
            <span className="text-xs text-muted-foreground">
              {planningGoals.length} visibles
            </span>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {planningGoals.map((goal) => (
              <article key={goal.id} className="surface p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-card-foreground">
                      {goal.name}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {goal.periodLabel}
                      {goal.accountName ? ` · ${goal.accountName}` : ""}
                    </p>
                  </div>
                  <span
                    className={
                      goal.tone === "success"
                        ? "text-xs font-medium text-success"
                        : goal.tone === "danger"
                          ? "text-xs font-medium text-danger"
                          : goal.tone === "warning"
                            ? "text-xs font-medium text-warning"
                            : "text-xs font-medium text-muted-foreground"
                    }
                  >
                    {goal.progressPercent} %
                  </span>
                </div>
                <div className="mt-4 h-2 rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-accent transition-all duration-200"
                    style={{
                      width: `${Math.max(0, Math.min(100, goal.progressPercent))}%`,
                      backgroundColor: goal.color ?? undefined,
                    }}
                  />
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">
                    {formatCurrency(goal.actualAmount)}
                  </span>
                  <span className="font-medium text-card-foreground">
                    {formatCurrency(goal.targetAmount)}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
