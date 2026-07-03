"use client";

import { ArrowDownCircle, ArrowLeftRight, ArrowUpCircle, CalendarClock, Landmark, PiggyBank, ReceiptText, Sigma, TrendingDown, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/format";
import type { DashboardData, DashboardDetailKey } from "@/lib/finance";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "success" | "warning" | "danger";
type IconKey = "landmark" | "income" | "expense" | "reimbursement" | "net" | "result" | "transfer" | "average" | "uncategorized" | "top";

const icons = {
  landmark: Landmark,
  income: ArrowUpCircle,
  expense: ArrowDownCircle,
  reimbursement: TrendingDown,
  net: ReceiptText,
  result: PiggyBank,
  transfer: ArrowLeftRight,
  average: Sigma,
  uncategorized: ReceiptText,
  top: CalendarClock
};

function DashboardButtonCard({ title, value, caption, icon, tone = "neutral", emphasis = false, onClick, className }: { title: string; value: string; caption: string; icon: IconKey; tone?: Tone; emphasis?: boolean; onClick?: () => void; className?: string }) {
  const Icon = icons[icon];
  return (
    <button type="button" onClick={onClick} className={cn("rounded-lg border border-border bg-card p-4 text-left shadow-sm transition hover:border-accent/70 hover:bg-muted/30 focus:outline-none focus:ring-2 focus:ring-accent/40", emphasis && "bg-muted/30", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase text-muted-foreground">{title}</p>
          <p className={cn("mt-2 truncate font-semibold tracking-normal text-card-foreground", emphasis ? "text-3xl" : "text-2xl")}>{value}</p>
        </div>
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-md border", tone === "neutral" && "border-border bg-muted text-muted-foreground", tone === "success" && "border-success/25 bg-success/10 text-success", tone === "warning" && "border-warning/25 bg-warning/10 text-warning", tone === "danger" && "border-danger/25 bg-danger/10 text-danger")}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{caption}</p>
    </button>
  );
}

export function DashboardMetrics({ data }: { data: DashboardData }) {
  const [detailKey, setDetailKey] = useState<DashboardDetailKey | null>(null);
  const resultTone = data.metrics.periodResult >= 0 ? "success" : "danger";
  const monthlySavingsTone = data.metrics.monthlySavings >= 0 ? "success" : "danger";
  const details = detailKey ? data.details[detailKey] : [];
  const detailTitle = useMemo(() => {
    const titles: Record<DashboardDetailKey, string> = {
      realIncome: "Ingresos reales del periodo",
      grossExpenses: "Gastos brutos del periodo",
      reimbursements: "Reembolsos recibidos",
      netExpenses: "Gastos netos reales",
      periodResult: "Resultado del periodo",
      internalTransfers: "Transferencias internas",
      topCategory: "Mayor gasto",
      uncategorized: "Movimientos sin categoría",
      averageMonthlyNetExpense: "Media mensual de gasto neto"
    };
    return detailKey ? titles[detailKey] : "Detalle";
  }, [detailKey]);

  return (
    <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-12">
        <DashboardButtonCard title={data.selectedAccount ? "Saldo de la cuenta" : "Saldo total"} value={formatCurrency(data.metrics.currentBalance)} caption={data.selectedAccount ? "Último saldo conocido de esta cuenta." : "Suma de saldos actuales de cuentas activas."} icon="landmark" emphasis className="xl:col-span-3" />
        <DashboardButtonCard title="Ingresos reales del periodo" value={formatCurrency(data.metrics.totalIncome)} caption="Entradas reales del periodo, sin reembolsos ni movimientos entre cuentas propias." icon="income" tone="success" className="xl:col-span-3" onClick={() => setDetailKey("realIncome")} />
        <DashboardButtonCard title="Gastos brutos del periodo" value={formatCurrency(data.metrics.grossExpenses)} caption="Salidas reales antes de descontar Bizums u otros reembolsos." icon="expense" tone="danger" className="xl:col-span-3" onClick={() => setDetailKey("grossExpenses")} />
        <DashboardButtonCard title="Resultado del periodo" value={formatCurrency(data.metrics.periodResult)} caption="Ingresos reales menos gastos netos reales del periodo seleccionado." icon="result" tone={resultTone} className="xl:col-span-3" onClick={() => setDetailKey("periodResult")} />
        <DashboardButtonCard title="Reembolsos recibidos" value={formatCurrency(data.metrics.reimbursements)} caption="Ingresos marcados como reembolso y vinculados a gastos." icon="reimbursement" tone="success" className="xl:col-span-2" onClick={() => setDetailKey("reimbursements")} />
        <DashboardButtonCard title="Gastos netos reales" value={formatCurrency(data.metrics.netExpenses)} caption="Gastos brutos menos reembolsos recibidos en el periodo." icon="net" tone="warning" className="xl:col-span-2" onClick={() => setDetailKey("netExpenses")} />
        <DashboardButtonCard title="Ahorro mensual" value={formatCurrency(data.metrics.monthlySavings)} caption="Resultado del último mes dentro del periodo seleccionado." icon="result" tone={monthlySavingsTone} className="xl:col-span-2" onClick={() => setDetailKey("periodResult")} />
        <DashboardButtonCard title="Transferencias internas" value={formatCurrency(data.metrics.internalTransferTotal)} caption="Movimientos entre tus cuentas; no cuentan como gasto ni ingreso real." icon="transfer" tone="neutral" className="xl:col-span-2" onClick={() => setDetailKey("internalTransfers")} />
        <DashboardButtonCard title="Media mensual de gasto neto" value={formatCurrency(data.metrics.averageMonthlyExpense)} caption="Promedio mensual de gastos después de descontar reembolsos." icon="average" tone="warning" className="xl:col-span-2" onClick={() => setDetailKey("averageMonthlyNetExpense")} />
        <DashboardButtonCard title="Sin categoría" value={String(data.metrics.uncategorizedCount)} caption="Movimientos del periodo que conviene revisar." icon="uncategorized" tone={data.metrics.uncategorizedCount > 0 ? "warning" : "success"} className="xl:col-span-1" onClick={() => setDetailKey("uncategorized")} />
        <DashboardButtonCard title="Mayor gasto" value={data.metrics.topCategory} caption={`${formatCurrency(data.metrics.topCategoryAmount)} netos · Actualizado: ${formatDate(data.metrics.lastUpdate)}`} icon="top" className="xl:col-span-1" onClick={() => setDetailKey("topCategory")} />
      </section>

      {detailKey ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="max-h-[88vh] w-full max-w-5xl overflow-hidden rounded-lg border border-border bg-card shadow-xl">
            <div className="flex items-center justify-between gap-3 border-b border-border p-4">
              <div>
                <h3 className="text-base font-semibold text-card-foreground">{detailTitle}</h3>
                <p className="text-sm text-muted-foreground">{details.length} movimientos · {data.periodLabel}</p>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setDetailKey(null)} title="Cerrar"><X className="h-4 w-4" /></Button>
            </div>
            <div className="max-h-[70vh] overflow-auto">
              {details.length === 0 ? (
                <p className="p-5 text-sm text-muted-foreground">No hay movimientos para este detalle.</p>
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