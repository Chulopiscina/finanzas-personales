"use client";
import { request } from "@/lib/client-request";

import Link from "next/link";
import {
  ArrowDownCircle,
  ArrowLeftRight,
  ArrowUpCircle,
  ArrowUpRight,
  Goal,
  Home,
  Landmark,
  PiggyBank,
  ReceiptText,
  ShoppingBag,
  WalletCards,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useDialogFocus } from "@/components/use-dialog-focus";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/format";
import type { DashboardData, DashboardDetailKey } from "@/lib/finance";
import { cn } from "@/lib/utils";
import { RecurringPaymentsWidget } from "@/components/recurring-payments-widget";

type CardTone = "green" | "red" | "blue" | "gray" | "purple" | "orange";
type CardIcon =
  | "balance"
  | "income"
  | "expense"
  | "result"
  | "transfer"
  | "uncategorized"
  | "fixed"
  | "variable"
  | "budget"
  | "goal";

const toneClasses: Record<
  CardTone,
  { border: string; icon: string; text: string; progress: string }
> = {
  green: {
    border: "border-emerald-500/20",
    icon: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    text: "text-emerald-600 dark:text-emerald-400",
    progress: "bg-emerald-500",
  },
  red: {
    border: "border-red-500/20",
    icon: "bg-red-500/10 text-red-600 dark:text-red-400",
    text: "text-red-600 dark:text-red-400",
    progress: "bg-red-500",
  },
  blue: {
    border: "border-blue-500/20",
    icon: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    text: "text-blue-600 dark:text-blue-400",
    progress: "bg-blue-500",
  },
  gray: {
    border: "border-slate-400/25",
    icon: "bg-slate-500/10 text-slate-500 dark:text-slate-300",
    text: "text-muted-foreground",
    progress: "bg-slate-400",
  },
  purple: {
    border: "border-violet-500/20",
    icon: "bg-violet-500/10 text-violet-600 dark:text-violet-300",
    text: "text-violet-600 dark:text-violet-300",
    progress: "bg-violet-500",
  },
  orange: {
    border: "border-orange-500/20",
    icon: "bg-orange-500/10 text-orange-600 dark:text-orange-300",
    text: "text-orange-600 dark:text-orange-300",
    progress: "bg-orange-500",
  },
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
  goal: Goal,
};

const cardBaseClass =
  "group relative flex h-full min-w-0 min-h-[160px] flex-col rounded-lg border bg-card p-4 text-left shadow-sm transition-colors duration-150 sm:p-5";
const interactiveCardClass =
  "hover:bg-muted/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";
const actionLinkClass = "action-link";

function FinanceCard({
  title,
  value,
  icon,
  tone,
  indicator = "—",
  onClick,
  large = false,
  className,
}: {
  title: string;
  value: string;
  icon: CardIcon;
  tone: CardTone;
  indicator?: string;
  onClick?: () => void;
  large?: boolean;
  className?: string;
}) {
  const Icon = icons[icon];
  const colors = toneClasses[tone];
  const cardClassName = cn(
    cardBaseClass,
    colors.border,
    onClick && interactiveCardClass,
    className,
  );
  const content = (
    <>
      <div className="flex items-start justify-between gap-4">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
            colors.icon,
          )}
        >
          <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
        </div>
        {onClick ? (
          <ArrowUpRight
            className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-accent"
            aria-hidden="true"
          />
        ) : (
          <span className={cn("text-xs", colors.text)}>{indicator}</span>
        )}
      </div>
      <div className="mt-auto pt-5">
        <p className="text-xs text-muted-foreground">{title}</p>
        <p
          className={cn(
            "mt-2 break-words font-semibold tabular-nums tracking-normal text-card-foreground",
            large ? "text-2xl sm:text-3xl" : "text-xl sm:text-2xl",
          )}
        >
          {value}
        </p>
      </div>
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cardClassName}>
        {content}
      </button>
    );
  }

  return <div className={cardClassName}>{content}</div>;
}

function ProgressLine({ value, tone }: { value: number; tone: CardTone }) {
  const width = Math.max(0, Math.min(100, value));
  return (
    <div
      className="h-1.5 overflow-hidden rounded-full bg-muted"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={width}
      aria-label="Progreso"
    >
      <div
        className={cn(
          "h-full rounded-full transition-all duration-200",
          toneClasses[tone].progress,
        )}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

function SpendingTypeCard({
  title,
  amount,
  percent,
  icon,
  tone,
  emptyText,
}: {
  title: string;
  amount: number;
  percent: number;
  icon: CardIcon;
  tone: CardTone;
  emptyText: string;
}) {
  const Icon = icons[icon];
  const colors = toneClasses[tone];
  const hasData = amount > 0;

  return (
    <article className={cn(cardBaseClass, interactiveCardClass, colors.border)}>
      <div className="flex items-start justify-between gap-4">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
            colors.icon,
          )}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <span
          className={cn(
            "rounded-full px-2 py-1 text-xs font-medium",
            colors.text,
          )}
        >
          {percent} %
        </span>
      </div>
      <div className="mt-auto pt-4">
        <p className="text-xs text-muted-foreground">{title}</p>
        <p className="mt-2 break-words text-xl font-semibold tabular-nums text-card-foreground sm:text-2xl">
          {formatCurrency(amount)}
        </p>
      </div>
      <div className="mt-3 space-y-2">
        <ProgressLine value={percent} tone={tone} />
        {!hasData ? (
          <p className="text-xs text-muted-foreground">{emptyText}</p>
        ) : null}
      </div>
    </article>
  );
}

function BudgetDashboardCard({ budget }: { budget: DashboardData["budget"] }) {
  const colors = toneClasses.orange;
  if (!budget.configured) {
    return (
      <PreparedFeatureCard
        title="Presupuesto mensual"
        subtitle="Sin presupuesto configurado"
        buttonLabel="Configurar presupuesto"
        href="/planning/budget"
        icon="budget"
        tone="orange"
      />
    );
  }

  const statusText =
    budget.status === "over"
      ? "Te estás pasando"
      : budget.status === "warning"
        ? "Cerca del límite"
        : "Vas bien";
  const statusTone =
    budget.status === "over"
      ? "text-danger"
      : budget.status === "warning"
        ? "text-warning"
        : "text-success";
  const rows = [
    ["Gastos fijos", budget.blocks.fixed],
    ["Gastos variables", budget.blocks.variable],
    ["Gastos extras", budget.blocks.extra],
    ["Ahorro", budget.blocks.savings],
  ] as const;

  return (
    <article
      className={cn(
        "surface flex h-full min-h-[230px] flex-col p-5 sm:p-6",
        colors.border,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
            colors.icon,
          )}
        >
          <WalletCards className="h-5 w-5" aria-hidden="true" />
        </div>
        <span
          className={cn(
            "rounded-full px-2 py-1 text-xs font-medium",
            statusTone,
          )}
        >
          {statusText}
        </span>
      </div>
      <div className="mt-6 grid flex-1 gap-5 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">
            Presupuesto mensual
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-normal text-card-foreground">
            {formatCurrency(budget.spent)} / {formatCurrency(budget.totalLimit)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Restante: {formatCurrency(budget.remaining)}
          </p>
        </div>
        <Link href="/planning/budget" className={actionLinkClass}>
          Editar
        </Link>
      </div>
      <div className="mt-5 space-y-3">
        <ProgressLine value={budget.percent} tone="orange" />
        <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
          {rows.map(([label, row]) => (
            <div key={label} className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span>{label}</span>
                <span>
                  {formatCurrency(row.actual)} / {formatCurrency(row.limit)}
                </span>
              </div>
              <ProgressLine
                value={row.percent}
                tone={label === "Ahorro" ? "blue" : "orange"}
              />
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

function SavingsGoalDashboardCard({
  savingsGoal,
}: {
  savingsGoal: DashboardData["savingsGoal"];
}) {
  const colors = toneClasses.blue;
  if (!savingsGoal.configured) {
    return (
      <PreparedFeatureCard
        title="Objetivo de ahorro"
        subtitle="No hay un objetivo de ahorro configurado"
        buttonLabel="Crear objetivo"
        href="/planning"
        icon="goal"
        tone="blue"
      />
    );
  }

  const statusText =
    savingsGoal.progressPercent >= 100
      ? "Completado"
      : savingsGoal.progressPercent >= 60
        ? "En camino"
        : "Pendiente";
  const statusTone =
    savingsGoal.progressPercent >= 100
      ? "text-success"
      : savingsGoal.progressPercent >= 60
        ? "text-warning"
        : colors.text;

  return (
    <article
      className={cn(
        "surface flex h-full min-h-[230px] flex-col p-5 sm:p-6",
        colors.border,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
            colors.icon,
          )}
        >
          <Goal className="h-5 w-5" aria-hidden="true" />
        </div>
        <span
          className={cn(
            "rounded-full px-2 py-1 text-xs font-medium",
            statusTone,
          )}
        >
          {statusText}
        </span>
      </div>
      <div className="mt-6 grid flex-1 gap-5 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">
            Objetivo de ahorro
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-normal text-card-foreground">
            {formatCurrency(savingsGoal.actualAmount)} /{" "}
            {formatCurrency(savingsGoal.targetAmount)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Restante: {formatCurrency(savingsGoal.remaining)}
          </p>
        </div>
        <Link href="/planning" className={actionLinkClass}>
          Editar
        </Link>
      </div>
      <div className="mt-5 space-y-2">
        <ProgressLine value={savingsGoal.progressPercent} tone="blue" />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{savingsGoal.count} objetivos activos</span>
          <span>{savingsGoal.progressPercent} %</span>
        </div>
      </div>
    </article>
  );
}

function PreparedFeatureCard({
  title,
  subtitle,
  buttonLabel,
  href,
  icon,
  tone,
}: {
  title: string;
  subtitle: string;
  buttonLabel: string;
  href: string;
  icon: CardIcon;
  tone: CardTone;
}) {
  const Icon = icons[icon];
  const colors = toneClasses[tone];

  return (
    <article
      className={cn(
        "surface flex h-full min-h-[230px] flex-col p-5 sm:p-6",
        colors.border,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
            colors.icon,
          )}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <span className="rounded-full px-2 py-1 text-xs font-medium text-muted-foreground">
          0 %
        </span>
      </div>
      <div className="mt-6 grid flex-1 gap-5 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="mt-2 max-w-sm text-base font-medium leading-relaxed text-muted-foreground">
            {subtitle}
          </p>
        </div>
        <Link href={href} className={actionLinkClass}>
          {buttonLabel}
        </Link>
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

export function DashboardMetrics({ data }: { data: DashboardData }) {
  const [detailKey, setDetailKey] = useState<DashboardDetailKey | null>(null);
  const resultPositive = data.metrics.periodResult >= 0;
  const expenseBase =
    data.metrics.grossExpenses > 0 ? data.metrics.grossExpenses : 0;
  const fixedExpensePercent =
    expenseBase > 0
      ? Math.round((data.metrics.fixedExpenses / expenseBase) * 100)
      : 0;
  const variableExpensePercent =
    expenseBase > 0
      ? Math.round((data.metrics.variableExpenses / expenseBase) * 100)
      : 0;
  const [details, setDetails] = useState<
    DashboardData["details"]["realIncome"]
  >([]);
  const [detailPage, setDetailPage] = useState(1);
  const [detailTotal, setDetailTotal] = useState(0);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  useDialogFocus(Boolean(detailKey), () => setDetailKey(null));
  useEffect(() => {
    setDetailPage(1);
  }, [detailKey]);
  useEffect(() => {
    if (!detailKey) return;
    const controller = new AbortController();
    setDetailLoading(true);
    setDetailError("");
    const params = new URLSearchParams({
      kind: detailKey,
      page: String(detailPage),
      category: data.metrics.topCategory,
    });
    const target = new URLSearchParams(window.location.search).get("userId");
    if (target) params.set("userId", target);
    if (data.selectedAccount) params.set("accountId", data.selectedAccount.id);
    if (data.range.start) params.set("start", data.range.start);
    if (data.range.end) params.set("end", data.range.end);
    void request(`/api/dashboard/details?${params}`, {
      signal: controller.signal,
    }).then(async (response) => {
      const payload = await response.json();
      if (controller.signal.aborted) return;
      if (response.ok) {
        setDetails(payload.rows);
        setDetailTotal(payload.total);
      } else setDetailError(payload.error ?? "No se pudo cargar el detalle.");
      setDetailLoading(false);
    });
    return () => controller.abort();
  }, [
    detailKey,
    detailPage,
    data.selectedAccount,
    data.range.start,
    data.range.end,
    data.metrics.topCategory,
  ]);
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
      averageMonthlyNetExpense: "Media mensual",
    };
    return detailKey ? titles[detailKey] : "Detalle";
  }, [detailKey]);

  return (
    <>
      <section
        aria-label="Resumen financiero"
        className="grid grid-cols-2 gap-3 xl:grid-cols-4 xl:gap-4"
      >
        <FinanceCard
          title={data.selectedAccount ? "Saldo" : "Saldo total"}
          value={formatCurrency(data.metrics.currentBalance)}
          icon="balance"
          tone="green"
          large
        />
        <FinanceCard
          title="Ingresos reales"
          value={formatCurrency(data.metrics.totalIncome)}
          icon="income"
          tone="green"
          onClick={() => setDetailKey("realIncome")}
        />
        <FinanceCard
          title="Gastos brutos"
          value={formatCurrency(data.metrics.grossExpenses)}
          icon="expense"
          tone="red"
          onClick={() => setDetailKey("grossExpenses")}
        />
        <FinanceCard
          title="Ahorro del periodo"
          value={formatCurrency(data.metrics.periodResult)}
          icon="result"
          tone={resultPositive ? "blue" : "red"}
          onClick={() => setDetailKey("periodResult")}
        />
      </section>

      <section
        aria-label="Distribución del periodo"
        className="grid grid-cols-2 gap-3 xl:grid-cols-4 xl:gap-4"
      >
        <SpendingTypeCard
          title="Gastos fijos"
          amount={data.metrics.fixedExpenses}
          percent={fixedExpensePercent}
          icon="fixed"
          tone="purple"
          emptyText="No existen gastos fijos registrados."
        />
        <SpendingTypeCard
          title="Gastos variables"
          amount={data.metrics.variableExpenses}
          percent={variableExpensePercent}
          icon="variable"
          tone="orange"
          emptyText="No existen gastos variables registrados."
        />
        <FinanceCard
          title="Transferencias internas"
          value={formatCurrency(data.metrics.internalTransferTotal)}
          icon="transfer"
          tone="blue"
          onClick={() => setDetailKey("internalTransfers")}
        />
        <FinanceCard
          title="Sin categorizar"
          value={String(data.metrics.uncategorizedCount)}
          icon="uncategorized"
          tone="gray"
          onClick={() => setDetailKey("uncategorized")}
        />
      </section>

      <div
        className="flex flex-wrap gap-x-5 gap-y-3 border-y border-border py-4 text-xs"
        aria-label="Desglose financiero"
      >
        {(
          [
            {
              label: "Gasto neto",
              key: "netExpenses",
              value: data.metrics.netExpenses,
            },
            {
              label: "Reembolsos",
              key: "reimbursements",
              value: data.metrics.reimbursements,
            },
            {
              label: "Media mensual",
              key: "averageMonthlyNetExpense",
              value: data.metrics.averageMonthlyExpense,
            },
          ] as const
        ).map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setDetailKey(item.key)}
            className="flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <span>{item.label}</span>
            <strong className="font-medium tabular-nums text-foreground">
              {formatCurrency(item.value)}
            </strong>
            <ArrowUpRight className="h-3 w-3" />
          </button>
        ))}
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        El saldo es el actual de tus cuentas. El resto corresponde al periodo
        seleccionado. Las transferencias internas no son ingresos ni gastos.
      </p>

      {detailKey ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[88vh] w-full max-w-5xl overflow-hidden rounded-lg border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-border p-5">
              <div>
                <h3 className="text-lg font-semibold text-card-foreground">
                  {detailTitle}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {detailTotal} movimientos · {data.periodLabel}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setDetailKey(null)}
                title="Cerrar"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="max-h-[70vh] overflow-auto">
              {detailLoading || detailError ? (
                <p className="p-6 text-sm text-muted-foreground" role="status">
                  {detailError || "Cargando movimientos..."}
                </p>
              ) : details.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">
                  No hay movimientos para este detalle.
                </p>
              ) : (
                <>
                  <div className="space-y-3 p-4 md:hidden">
                    {details.map((tx) => (
                      <article
                        key={tx.id}
                        className="space-y-2 rounded-lg border border-border p-3 text-sm"
                      >
                        <div className="flex justify-between gap-3">
                          <span className="text-muted-foreground">
                            {formatDate(tx.date)}
                          </span>
                          <strong
                            className={
                              tx.amount < 0 ? "text-danger" : "text-success"
                            }
                          >
                            {formatCurrency(tx.amount)}
                          </strong>
                        </div>
                        <p className="break-words font-medium">{tx.concept}</p>
                        <p className="text-xs text-muted-foreground">
                          {tx.account} · {tx.category}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {tx.isInternalTransfer
                            ? "Transferencia interna"
                            : tx.isReimbursement
                              ? "Reembolso"
                              : tx.type === "EXPENSE"
                                ? "Gasto"
                                : "Ingreso"}
                        </p>
                        {tx.linkedMovements.length ? (
                          <p className="text-xs text-muted-foreground">
                            {tx.linkedMovements.join(" · ")}
                          </p>
                        ) : null}
                      </article>
                    ))}
                  </div>
                  <table className="hidden w-full min-w-[980px] border-collapse text-sm md:table">
                    <thead className="sticky top-0 bg-muted text-left text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 font-medium">Fecha</th>
                        <th className="px-4 py-3 font-medium">Concepto</th>
                        <th className="px-4 py-3 font-medium">Cuenta</th>
                        <th className="px-4 py-3 font-medium">Categoría</th>
                        <th className="px-4 py-3 text-right font-medium">
                          Importe
                        </th>
                        <th className="px-4 py-3 font-medium">Tipo</th>
                        <th className="px-4 py-3 font-medium">Relación</th>
                      </tr>
                    </thead>
                    <tbody>
                      {details.map((tx) => (
                        <tr
                          key={`${detailKey}-${tx.id}`}
                          className="border-t border-border"
                        >
                          <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                            {formatDate(tx.date)}
                          </td>
                          <td className="max-w-sm px-4 py-3 text-card-foreground">
                            <p className="truncate">{tx.concept}</p>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {tx.account}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {tx.category}
                          </td>
                          <td
                            className={
                              tx.amount >= 0
                                ? "whitespace-nowrap px-4 py-3 text-right font-medium text-success"
                                : "whitespace-nowrap px-4 py-3 text-right font-medium text-danger"
                            }
                          >
                            {formatCurrency(tx.amount)}
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              tone={
                                tx.isInternalTransfer
                                  ? "neutral"
                                  : tx.isReimbursement
                                    ? "success"
                                    : tx.type === "EXPENSE"
                                      ? "danger"
                                      : "success"
                              }
                            >
                              {tx.isInternalTransfer
                                ? "Transferencia interna"
                                : tx.isReimbursement
                                  ? "Reembolso"
                                  : tx.type === "EXPENSE"
                                    ? "Gasto"
                                    : tx.type === "INCOME"
                                      ? "Ingreso"
                                      : "Transferencia"}
                            </Badge>
                          </td>
                          <td className="max-w-xs px-4 py-3 text-muted-foreground">
                            {tx.linkedMovements.length > 0
                              ? tx.linkedMovements.join(" · ")
                              : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-border p-3 text-sm">
              <Button
                variant="secondary"
                size="sm"
                disabled={detailLoading || detailPage <= 1}
                onClick={() => setDetailPage((page) => page - 1)}
              >
                Anterior
              </Button>
              <span>
                {detailPage} / {Math.max(1, Math.ceil(detailTotal / 50))}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={detailLoading || detailPage * 50 >= detailTotal}
                onClick={() => setDetailPage((page) => page + 1)}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function DashboardPlanning({ data }: { data: DashboardData }) {
  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)]">
      <div className="grid min-w-0 gap-5 sm:grid-cols-2 lg:grid-cols-1">
        <BudgetDashboardCard budget={data.budget} />
        <SavingsGoalDashboardCard savingsGoal={data.savingsGoal} />
      </div>
      <RecurringPaymentsWidget payments={data.recurringSchedule} today={data.recurringToday} />
    </div>
  );
}
