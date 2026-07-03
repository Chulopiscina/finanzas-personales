"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { formatCurrency } from "@/lib/format";

const CHART_AXIS_STYLE = { fill: "hsl(var(--muted-foreground))", fontSize: 12 };

type CategoryRow = { name: string; value: number; color: string };
type MonthlyRow = {
  month: string;
  income: number;
  expenses: number;
  savings: number;
  transactions: number;
};

function percentNumber(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}

function formatPercent(value: number, total: number) {
  return `${percentNumber(value, total)} %`;
}

function percentWidth(value: number, total: number) {
  return `${percentNumber(value, total)}%`;
}

function SummaryPill({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "success" | "danger" }) {
  return (
    <div className="rounded-md border border-border bg-muted/50 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={tone === "success" ? "mt-1 font-medium text-success" : tone === "danger" ? "mt-1 font-medium text-danger" : "mt-1 font-medium text-card-foreground"}>
        {value}
      </p>
    </div>
  );
}

export function DashboardCharts({
  categories,
  monthly,
  comparison
}: {
  categories: CategoryRow[];
  monthly: MonthlyRow[];
  comparison: Array<{ month: string; gastos: number; ingresos: number }>;
}) {
  const hasCategories = categories.length > 0;
  const hasMonthly = monthly.length > 0;
  const categoryTotal = categories.reduce((sum, category) => sum + category.value, 0);
  const visibleCategories = categories.slice(0, 6);
  const latestComparison = comparison.at(-1);
  const latestIncome = latestComparison?.ingresos ?? 0;
  const latestExpenses = latestComparison?.gastos ?? 0;
  const latestDifference = latestIncome - latestExpenses;

  return (
    <div className="grid gap-4 xl:grid-cols-5">
      <section className="rounded-lg border border-border bg-card p-4 shadow-sm xl:col-span-3">
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-card-foreground">Gastos por categoría</h2>
            <p className="text-sm text-muted-foreground">Importes reales, sin transferencias internas</p>
          </div>
          <p className="text-sm font-medium text-card-foreground">{formatCurrency(categoryTotal)}</p>
        </div>
        {hasCategories ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(220px,0.9fr)_minmax(260px,1.1fr)] lg:items-center">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={visibleCategories} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={2}>
                    {visibleCategories.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {visibleCategories.map((category) => (
                <div key={category.name} className="rounded-md bg-muted/50 px-3 py-2">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: category.color }} />
                      <span className="truncate font-medium text-card-foreground">{category.name}</span>
                    </div>
                    <span className="whitespace-nowrap text-muted-foreground">{formatPercent(category.value, categoryTotal)}</span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-background">
                    <div className="h-full rounded-full" style={{ width: percentWidth(category.value, categoryTotal), backgroundColor: category.color }} />
                  </div>
                  <p className="mt-1 text-right text-sm font-medium text-card-foreground">{formatCurrency(category.value)}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex h-56 items-center justify-center rounded-md bg-muted/40 text-sm text-muted-foreground">Sin movimientos de gasto</div>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card p-4 shadow-sm xl:col-span-2">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-card-foreground">Ingresos frente a gastos</h2>
          <p className="text-sm text-muted-foreground">Últimos meses importados</p>
        </div>
        <div className="h-64">
          {hasMonthly ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparison} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="month" tick={CHART_AXIS_STYLE} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={(value) => `${Number(value) / 1000}k`} tick={CHART_AXIS_STYLE} tickLine={false} axisLine={false} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Bar dataKey="ingresos" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="gastos" fill="hsl(var(--danger))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center rounded-md bg-muted/40 text-sm text-muted-foreground">Sin datos mensuales</div>
          )}
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
          <SummaryPill label="Ingresos" value={formatCurrency(latestIncome)} tone="success" />
          <SummaryPill label="Gastos" value={formatCurrency(latestExpenses)} tone="danger" />
          <SummaryPill label="Diferencia" value={formatCurrency(latestDifference)} tone={latestDifference >= 0 ? "success" : "danger"} />
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-4 shadow-sm xl:col-span-5">
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-card-foreground">Evolución mensual</h2>
            <p className="text-sm text-muted-foreground">Ingresos, gastos reales y ahorro neto</p>
          </div>
          <p className="text-xs text-muted-foreground">Las transferencias internas no se incluyen como gasto real.</p>
        </div>
        <div className="h-72">
          {hasMonthly ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthly} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="savingsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="month" tick={CHART_AXIS_STYLE} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={(value) => `${Number(value) / 1000}k`} tick={CHART_AXIS_STYLE} tickLine={false} axisLine={false} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Area dataKey="income" name="Ingresos" stroke="hsl(var(--success))" fill="url(#incomeFill)" strokeWidth={2} />
                <Area dataKey="expenses" name="Gastos" stroke="hsl(var(--danger))" fill="transparent" strokeWidth={2} />
                <Area dataKey="savings" name="Ahorro" stroke="hsl(var(--accent))" fill="url(#savingsFill)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center rounded-md bg-muted/40 text-sm text-muted-foreground">Sin histórico</div>
          )}
        </div>
      </section>
    </div>
  );
}
