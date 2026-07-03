import {
  ArrowDownCircle,
  ArrowLeftRight,
  ArrowUpCircle,
  CalendarClock,
  Landmark,
  PiggyBank,
  ReceiptText,
  Sigma,
  TrendingUp
} from "lucide-react";
import { Role } from "@prisma/client";
import { DashboardAccountSelector } from "@/components/dashboard-account-selector";
import { DashboardCharts } from "@/components/dashboard-charts";
import { MetricCard } from "@/components/metric-card";
import { getAuthorizedUserId, getSessionUser } from "@/lib/auth";
import { formatCurrency, formatDate } from "@/lib/format";
import { getDashboardData } from "@/lib/finance";
import { prisma } from "@/lib/prisma";

type Props = {
  searchParams?: Promise<{ userId?: string; accountId?: string }>;
};

export default async function DashboardPage({ searchParams }: Props) {
  const session = await getSessionUser();
  if (!session) {
    return null;
  }

  const params = await searchParams;
  const userId = getAuthorizedUserId(session.user, params?.userId);
  const [data, owner] = await Promise.all([
    getDashboardData(userId, params?.accountId),
    userId !== session.user.id && session.user.role === Role.ADMIN
      ? prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } })
      : null
  ]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {owner ? `${owner.name} · ${owner.email}` : data.selectedAccount ? `Viendo ${data.selectedAccount.name}` : "Todas las cuentas activas"}
          </p>
        </div>
        <DashboardAccountSelector accounts={data.accounts} selectedAccountId={data.selectedAccount?.id ?? null} />
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title={data.selectedAccount ? "Saldo de la cuenta" : "Saldo total"} value={formatCurrency(data.metrics.currentBalance)} icon={Landmark} />
        <MetricCard title="Ingresos totales" value={formatCurrency(data.metrics.totalIncome)} icon={ArrowUpCircle} tone="success" />
        <MetricCard title="Gastos totales" value={formatCurrency(data.metrics.totalExpenses)} icon={ArrowDownCircle} tone="danger" />
        <MetricCard title="Ahorro acumulado" value={formatCurrency(data.metrics.accumulatedSavings)} icon={PiggyBank} tone="success" />
        <MetricCard title="Ahorro mensual" value={formatCurrency(data.metrics.monthlySavings)} icon={TrendingUp} />
        <MetricCard title="Transferencias internas" value={formatCurrency(data.metrics.internalTransferTotal)} icon={ArrowLeftRight} />
        <MetricCard title="Transacciones" value={String(data.metrics.transactionCount)} icon={ReceiptText} />
        <MetricCard title="Sin categoría" value={String(data.metrics.uncategorizedCount)} icon={ReceiptText} />
        <MetricCard
          title="Mayor gasto"
          value={data.metrics.topCategory}
          caption={`Actualizado: ${formatDate(data.metrics.lastUpdate)}`}
          icon={CalendarClock}
        />
      </div>

      <DashboardCharts categories={data.charts.categories} monthly={data.charts.monthly} comparison={data.charts.comparison} />

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-lg border border-border bg-card p-5 shadow-sm lg:col-span-1">
          <h2 className="text-base font-semibold text-card-foreground">Últimos extractos</h2>
          <div className="mt-4 space-y-3">
            {data.recentImports.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aún no hay extractos subidos.</p>
            ) : data.recentImports.map((item) => (
              <div key={item.id} className="rounded-md bg-muted px-3 py-2 text-sm">
                <p className="truncate font-medium text-foreground">{item.fileName}</p>
                <p className="text-muted-foreground">{item.accountName} · {item.insertedRows} movimientos</p>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <h2 className="text-base font-semibold text-card-foreground">Resumen mensual</h2>
          <div className="mt-4 space-y-3">
            {data.insights.map((insight) => (
              <p key={insight} className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">{insight}</p>
            ))}
          </div>
        </section>
        <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <h2 className="text-base font-semibold text-card-foreground">Avisos</h2>
          <div className="mt-4 space-y-3">
            {data.recommendations.map((tip) => (
              <p key={tip} className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">{tip}</p>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}