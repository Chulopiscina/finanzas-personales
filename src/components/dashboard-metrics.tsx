"use client";

import Link from "next/link";
import { ArrowDownCircle, ArrowLeftRight, ArrowUpCircle, Goal, Home, Landmark, PiggyBank, ReceiptText, ShoppingBag, WalletCards, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/format";
import type { DashboardData, DashboardDetailKey } from "@/lib/finance";
import { cn } from "@/lib/utils";

type CardTone = "green" | "red" | "blue" | "gray" | "purple" | "orange";
type CardIcon = "balance" | "income" | "expense" | "result" | "transfer" | "uncategorized" | "fixed" | "variable" | "budget" | "goal";

const toneClasses: Record<CardTone, { border: string; icon: string; text: string; progress: string }> = {
  green: { border: "border-emerald-500/20", icon: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", text: "text-emerald-600 dark:text-emerald-400", progress: "bg-emerald-500" },
  red: { border: "border-red-500/20", icon: "bg-red-500/10 text-red-600 dark:text-red-400", text: "text-red-600 dark:text-red-400", progress: "bg-red-500" },
  blue: { border: "border-blue-500/20", icon: "bg-blue-500/10 text-blue-600 dark:text-blue-400", text: "text-blue-600 dark:text-blue-400", progress: "bg-blue-500" },
  gray: { border: "border-slate-400/25", icon: "bg-slate-500/10 text-slate-500 dark:text-slate-300", text: "text-muted-foreground", progress: "bg-slate-400" },
  purple: { border: "border-violet-500/20", icon: "bg-violet-500/10 text-violet-600 dark:text-violet-300", text: "text-violet-600 dark:text-violet-300", progress: "bg-violet-500" },
  orange: { border: "border-orange-500/20", icon: "bg-orange-500/10 text-orange-600 dark:text-orange-300", text: "text-orange-600 dark:text-orange-300", progress: "bg-orange-500" }
};

const icons = {
  balance: Landmark,
  income: ArrowUpCircle,
  expense: ArrowDownCircle,
  result: PiggyBank,
  transfer: ArrowLeftRight,
  uncategorized: ReceiptText,
  fixed: Home,
  variable: ShoppingBag,
  budget: WalletCards,
  goal: Goal
};

const cardBaseClass = "group flex h-full min-h-[190px] flex-col rounded-2xl border bg-card p-5 text-left shadow-[0_12px_30px_rgba(15,23,42,0.04)] transition duration-200 ease-out dark:shadow-none";
const interactiveCardClass = "hover:-translate-y-0.5 hover:shadow-[0_18px_45px_rgba(15,23,42,0.08)] focus:outline-none focus:ring-2 focus:ring-accent/30";
const actionLinkClass = "inline-flex h-10 items-center justify-center rounded-full border border-border bg-card px-4 text-sm font-medium text-card-foreground transition duration-200 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-accent/30";

function FinanceCard({ title, value, icon, tone, indicator = "—", onClick, large = false, className }: { title: string; value: string; icon: CardIcon; tone: CardTone; indicator?: string; onClick?: () => void; large?: boolean; className?: string }) {
  const Icon = icons[icon];
  const colors = toneClasses[tone];
  const cardClassName = cn(cardBaseClass, colors.border, onClick && interactiveCardClass, className);
  const content = (
    <>
      <div className="flex items-start justify-between gap-4">
        <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full", colors.icon)}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <span className={cn("rounded-full px-2 py-1 text-xs font-medium", colors.text)}>{indicator}</span>
      </div>
      <div className="mt-auto pt-7">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <p className={cn("mt-2 truncate font-semibold tracking-normal text-card-foreground", large ? "text-4xl" : "text-3xl")}>{value}</p>
      </div>
    </>
  );

  if (onClick) {
    return <button type="button" onClick={onClick} className={cardClassName}>{content}</button>;
  }

  return <div className={cardClassName}>{content}</div>;
}

function ProgressLine({ value, tone }: { value: number; tone: CardTone }) {
  const width = Math.max(0, Math.min(100, value));
  return (
    <div className="h-2 rounded-full bg-muted">
      <div className={cn("h-full rounded-full transition-all duration-200", toneClasses[tone].progress)} style={{ width: `${width}%` }} />
    </div>
  );
}

function SpendingTypeCard({ title, amount, percent, icon, tone, emptyText }: { title: string; amount: number; percent: number; icon: CardIcon; tone: CardTone; emptyText: string }) {
  const Icon = icons[icon];
  const colors = toneClasses[tone];
  const hasData = amount > 0;

  return (
    <article className={cn(cardBaseClass, interactiveCardClass, colors.border)}>
      <div className="flex items-start justify-between gap-4">
        <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full", colors.icon)}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <span className={cn("rounded-full px-2 py-1 text-xs font-medium", colors.text)}>{percent} %</span>
      </div>
      <div className="mt-auto pt-6">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <p className="mt-2 text-3xl font-semibold tracking-normal text-card-foreground">{formatCurrency(amount)}</p>
      </div>
      <div className="mt-5 space-y-2">
        <ProgressLine value={percent} tone={tone} />
        {!hasData ? <p className="text-xs text-muted-foreground">{emptyText}</p> : null}
      </div>
    </article>
  );
}

function BudgetDashboardCard({ budget }: { budget: DashboardData["budget"] }) {
  const colors = toneClasses.orange;
  if (!budget.configured) {
    return <PreparedFeatureCard title="Presupuesto mensual" subtitle="Sin presupuesto configurado" buttonLabel="Configurar presupuesto" href="/planning/budget" icon="budget" tone="orange" />;
  }

  const statusText = budget.status === "over" ? "Te est?s pasando" : budget.status === "warning" ? "Cerca del l?mite" : "Vas bien";
  const statusTone = budget.status === "over" ? "text-danger" : budget.status === "warning" ? "text-warning" : "text-success";
  const rows = [
    ["Gastos fijos", budget.blocks.fixed],
    ["Gastos variables", budget.blocks.variable],
    ["Gastos extras", budget.blocks.extra],
    ["Ahorro", budget.blocks.savings]
  ] as const;

  return (
    <article className={cn("flex h-full min-h-[230px] flex-col rounded-2xl border bg-card p-5 shadow-[0_12px_30px_rgba(15,23,42,0.04)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_45px_rgba(15,23,42,0.08)] dark:shadow-none", colors.border)}>
      <div className="flex items-start justify-between gap-4">
        <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full", colors.icon)}>
          <WalletCards className="h-5 w-5" aria-hidden="true" />
        </div>
        <span className={cn("rounded-full px-2 py-1 text-xs font-medium", statusTone)}>{statusText}</span>
      </div>
      <div className="mt-6 grid flex-1 gap-5 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">Presupuesto mensual</p>
          <p className="mt-2 text-2xl font-semibold tracking-normal text-card-foreground">{formatCurrency(budget.spent)} / {formatCurrency(budget.totalLimit)}</p>
          <p className="mt-1 text-sm text-muted-foreground">Restante: {formatCurrency(budget.remaining)}</p>
        </div>
        <Link href="/planning/budget" className={actionLinkClass}>Editar</Link>
      </div>
      <div className="mt-5 space-y-3">
        <ProgressLine value={budget.percent} tone="orange" />
        <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
          {rows.map(([label, row]) => (
            <div key={label} className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span>{label}</span>
                <span>{formatCurrency(row.actual)} / {formatCurrency(row.limit)}</span>
              </div>
              <ProgressLine value={row.percent} tone={label === "Ahorro" ? "blue" : "orange"} />
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

function PreparedFeatureCard({ title, subtitle, buttonLabel, href, icon, tone }: { title: string; subtitle: string; buttonLabel: string; href: string; icon: CardIcon; tone: CardTone }) {
  const Icon = icons[icon];
  const colors = toneClasses[tone];

  return (
    <article className={cn("flex h-full min-h-[230px] flex-col rounded-2xl border bg-card p-5 shadow-[0_12px_30px_rgba(15,23,42,0.04)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_45px_rgba(15,23,42,0.08)] dark:shadow-none", colors.border)}>
      <div className="flex items-start justify-between gap-4">
        <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full", colors.icon)}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <span className="rounded-full px-2 py-1 text-xs font-medium text-muted-foreground">0 %</span>
      </div>
      <div className="mt-6 grid flex-1 gap-5 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="mt-2 text-2xl font-semibold tracking-normal text-card-foreground">{subtitle}</p>
        </div>
        <Link href={href} className={actionLinkClass}>{buttonLabel}</Link>
      </div>
      <div className="mt-5 space-y-2">
        <ProgressLine value={0} tone={tone} />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{formatCurrency(0)}</span>
          <span>{formatCurrency(0)}</span>
        </div>
      </div>
    </article>
  );
}

function paymentDaysLabel(days: number) {
  if (days === 0) return "Hoy";
  if (days === 1) return "Falta 1 d?a";
  return `Faltan ${days} d?as`;
}

function UpcomingPaymentsCard({ payments }: { payments: DashboardData["upcomingPayments"] }) {
  const hasPayments = payments.length > 0;

  return (
    <section className="rounded-2xl border border-blue-500/20 bg-card p-5 shadow-[0_12px_30px_rgba(15,23,42,0.04)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_45px_rgba(15,23,42,0.08)] dark:shadow-none">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <ReceiptText className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Pr?ximos pagos</p>
            <p className="mt-1 text-2xl font-semibold text-card-foreground">{hasPayments ? `${payments.length} previstos` : "No hay pagos recurrentes"}</p>
          </div>
        </div>
        <Link href="/planning/recurring-payments" className={actionLinkClass}>A?adir pago recurrente</Link>
      </div>
      {hasPayments ? (
        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          {payments.map((payment) => (
            <article key={payment.id} className="rounded-2xl border border-border bg-background p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(15,23,42,0.05)] dark:bg-muted/20 dark:shadow-none">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-card-foreground">{payment.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDate(payment.date)} - {paymentDaysLabel(payment.daysUntil)}</p>
                </div>
                <span className="whitespace-nowrap text-sm font-semibold text-card-foreground">{formatCurrency(payment.amount)}</span>
              </div>
              <p className="mt-3 truncate text-xs text-muted-foreground">{payment.accountName}{payment.categoryName ? ` - ${payment.categoryName}` : ""}</p>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-sm text-muted-foreground">
          No tienes pagos recurrentes configurados.
        </div>
      )}
    </section>
  );
}

export function DashboardMetrics({ data }: { data: DashboardData }) {
  const [detailKey, setDetailKey] = useState<DashboardDetailKey | null>(null);
  const resultPositive = data.metrics.periodResult >= 0;
  const expenseBase = data.metrics.grossExpenses > 0 ? data.metrics.grossExpenses : 0;
  const fixedExpensePercent = expenseBase > 0 ? Math.round((data.metrics.fixedExpenses / expenseBase) * 100) : 0;
  const variableExpensePercent = expenseBase > 0 ? Math.round((data.metrics.variableExpenses / expenseBase) * 100) : 0;
  const details = detailKey ? data.details[detailKey] : [];
  const detailTitle = useMemo(() => {
    const titles: Record<DashboardDetailKey, string> = {
      realIncome: "Ingresos",
      grossExpenses: "Gastos",
      reimbursements: "Reembolsos",
      netExpenses: "Gastos netos",
      periodResult: "Ahorro del periodo",
      internalTransfers: "Transferencias internas",
      topCategory: "Mayor gasto",
      uncategorized: "Sin categorizar",
      averageMonthlyNetExpense: "Media mensual"
    };
    return detailKey ? titles[detailKey] : "Detalle";
  }, [detailKey]);

  return (
    <>
      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <FinanceCard title={data.selectedAccount ? "Saldo" : "Saldo total"} value={formatCurrency(data.metrics.currentBalance)} icon="balance" tone="green" large />
        <FinanceCard title="Ingresos" value={formatCurrency(data.metrics.totalIncome)} icon="income" tone="green" onClick={() => setDetailKey("realIncome")} />
        <FinanceCard title="Gastos" value={formatCurrency(data.metrics.grossExpenses)} icon="expense" tone="red" onClick={() => setDetailKey("grossExpenses")} />
        <FinanceCard title="Ahorro del periodo" value={formatCurrency(data.metrics.periodResult)} icon="result" tone={resultPositive ? "blue" : "red"} onClick={() => setDetailKey("periodResult")} />
      </section>

      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <SpendingTypeCard title="Gastos fijos" amount={data.metrics.fixedExpenses} percent={fixedExpensePercent} icon="fixed" tone="purple" emptyText="No existen gastos fijos registrados." />
        <SpendingTypeCard title="Gastos variables" amount={data.metrics.variableExpenses} percent={variableExpensePercent} icon="variable" tone="orange" emptyText="No existen gastos variables registrados." />
        <FinanceCard title="Transferencias internas" value={formatCurrency(data.metrics.internalTransferTotal)} icon="transfer" tone="blue" onClick={() => setDetailKey("internalTransfers")} />
        <FinanceCard title="Sin categorizar" value={String(data.metrics.uncategorizedCount)} icon="uncategorized" tone="gray" onClick={() => setDetailKey("uncategorized")} />
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <PreparedFeatureCard title="Presupuesto mensual" subtitle="Sin presupuesto configurado" buttonLabel="Configurar presupuesto" href="/planning/budget" icon="budget" tone="orange" />
        <PreparedFeatureCard title="Objetivo de ahorro" subtitle="No hay un objetivo configurado" buttonLabel="Crear objetivo" href="/planning" icon="goal" tone="blue" />
      </section>

      <UpcomingPaymentsCard payments={data.upcomingPayments} />

      {detailKey ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="max-h-[88vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-border p-5">
              <div>
                <h3 className="text-lg font-semibold text-card-foreground">{detailTitle}</h3>
                <p className="text-sm text-muted-foreground">{details.length} movimientos · {data.periodLabel}</p>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setDetailKey(null)} title="Cerrar">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="max-h-[70vh] overflow-auto">
              {details.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">No hay movimientos para este detalle.</p>
              ) : (
                <table className="w-full min-w-[980px] border-collapse text-sm">
                  <thead className="sticky top-0 bg-muted text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Fecha</th>
                      <th className="px-4 py-3 font-medium">Concepto</th>
                      <th className="px-4 py-3 font-medium">Cuenta</th>
                      <th className="px-4 py-3 font-medium">Categoría</th>
                      <th className="px-4 py-3 text-right font-medium">Importe</th>
                      <th className="px-4 py-3 font-medium">Tipo</th>
                      <th className="px-4 py-3 font-medium">Relación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {details.map((tx) => (
                      <tr key={`${detailKey}-${tx.id}`} className="border-t border-border">
                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDate(tx.date)}</td>
                        <td className="max-w-sm px-4 py-3 text-card-foreground"><p className="truncate">{tx.concept}</p></td>
                        <td className="px-4 py-3 text-muted-foreground">{tx.account}</td>
                        <td className="px-4 py-3 text-muted-foreground">{tx.category}</td>
                        <td className={tx.amount >= 0 ? "whitespace-nowrap px-4 py-3 text-right font-medium text-success" : "whitespace-nowrap px-4 py-3 text-right font-medium text-danger"}>{formatCurrency(tx.amount)}</td>
                        <td className="px-4 py-3"><Badge tone={tx.isInternalTransfer ? "neutral" : tx.isReimbursement ? "success" : tx.type === "EXPENSE" ? "danger" : "success"}>{tx.isInternalTransfer ? "Transferencia interna" : tx.isReimbursement ? "Reembolso" : tx.type === "EXPENSE" ? "Gasto" : tx.type === "INCOME" ? "Ingreso" : "Transferencia"}</Badge></td>
                        <td className="max-w-xs px-4 py-3 text-muted-foreground">{tx.linkedMovements.length > 0 ? tx.linkedMovements.join(" · ") : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}


