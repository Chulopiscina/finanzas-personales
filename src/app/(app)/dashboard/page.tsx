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

  const scopeLabel = owner
    ? `${owner.name} - ${owner.email}`
    : data.selectedAccount
      ? `Cuenta seleccionada: ${data.selectedAccount.name}`
      : "Todas las cuentas activas";
  const savingsTone = data.metrics.accumulatedSavings >= 0 ? "success" : "danger";
  const monthlySavingsTone = data.metrics.monthlySavings >= 0 ? "success" : "danger";

  return (
    <div className="space-y-5">
      <header className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase text-muted-foreground">Panel financiero</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal text-foreground">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">{scopeLabel}</p>
        </div>
        <DashboardAccountSelector accounts={data.accounts} selectedAccountId={data.selectedAccount?.id ?? null} />
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-12">
        <MetricCard
          title={data.selectedAccount ? "Saldo de la cuenta" : "Saldo total"}
          value={formatCurrency(data.metrics.currentBalance)}
          caption={data.selectedAccount ? "Último saldo conocido de esta cuenta." : "Suma de saldos actuales de cuentas activas."}
          icon={Landmark}
          emphasis
          className="xl:col-span-3"
        />
        <MetricCard
          title="Ingresos totales"
          value={formatCurrency(data.metrics.totalIncome)}
          caption="Entradas reales, sin movimientos entre cuentas propias."
          icon={ArrowUpCircle}
          tone="success"
          className="xl:col-span-3"
        />
        <MetricCard
          title="Gastos totales"
          value={formatCurrency(data.metrics.totalExpenses)}
          caption="Salidas reales; las transferencias internas quedan fuera."
          icon={ArrowDownCircle}
          tone="danger"
          className="xl:col-span-3"
        />
        <MetricCard
          title="Ahorro acumulado"
          value={formatCurrency(data.metrics.accumulatedSavings)}
          caption="Ingresos menos gastos reales del periodo importado."
          icon={PiggyBank}
          tone={savingsTone}
          className="xl:col-span-3"
        />
        <MetricCard
          title="Ahorro mensual"
          value={formatCurrency(data.metrics.monthlySavings)}
          caption="Resultado del último mes con movimientos."
          icon={TrendingUp}
          tone={monthlySavingsTone}
          className="xl:col-span-2"
        />
        <MetricCard
          title="Transferencias internas"
          value={formatCurrency(data.metrics.internalTransferTotal)}
          caption="Movimientos entre tus cuentas; no cuentan como gasto real."
          icon={ArrowLeftRight}
          tone="neutral"
          className="xl:col-span-2"
        />
        <MetricCard
          title="Gasto medio mensual"
          value={formatCurrency(data.metrics.averageMonthlyExpense)}
          caption="Media de gastos reales por mes importado."
          icon={Sigma}
          tone="warning"
          className="xl:col-span-2"
        />
        <MetricCard
          title="Transacciones"
          value={String(data.metrics.transactionCount)}
          caption="Movimientos visibles en esta vista."
          icon={ReceiptText}
          className="xl:col-span-2"
        />
        <MetricCard
          title="Sin categoría"
          value={String(data.metrics.uncategorizedCount)}
          caption="Conviene revisarlas para mejorar estadísticas."
          icon={ReceiptText}
          tone={data.metrics.uncategorizedCount > 0 ? "warning" : "success"}
          className="xl:col-span-2"
        />
        <MetricCard
          title="Mayor gasto"
          value={data.metrics.topCategory}
          caption={`Actualizado: ${formatDate(data.metrics.lastUpdate)}`}
          icon={CalendarClock}
          className="xl:col-span-2"
        />
      </section>

      <DashboardCharts categories={data.charts.categories} monthly={data.charts.monthly} comparison={data.charts.comparison} />

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-card-foreground">Últimos extractos</h2>
            <span className="text-xs text-muted-foreground">{data.recentImports.length} recientes</span>
          </div>
          <div className="mt-3 space-y-2">
            {data.recentImports.length === 0 ? (
              <p className="rounded-md bg-muted/40 px-3 py-3 text-sm text-muted-foreground">Aún no hay extractos subidos.</p>
            ) : data.recentImports.map((item) => (
              <div key={item.id} className="rounded-md bg-muted/50 px-3 py-2 text-sm">
                <p className="truncate font-medium text-foreground">{item.fileName}</p>
                <p className="text-muted-foreground">{item.accountName} - {item.insertedRows} movimientos</p>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <h2 className="text-base font-semibold text-card-foreground">Resumen mensual</h2>
          <div className="mt-3 space-y-2">
            {data.insights.map((insight) => (
              <p key={insight} className="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">{insight}</p>
            ))}
          </div>
        </section>
        <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <h2 className="text-base font-semibold text-card-foreground">Avisos</h2>
          <div className="mt-3 space-y-2">
            {data.recommendations.map((tip) => (
              <p key={tip} className="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">{tip}</p>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
