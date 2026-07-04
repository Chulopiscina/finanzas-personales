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
const SOFT_CATEGORY_COLORS = ["#6ee7b7", "#93c5fd", "#fda4af", "#c4b5fd", "#fdba74", "#99f6e4", "#fde68a", "#bfdbfe"];

type CategoryRow = { name: string; value: number; color: string };
type VisualCategoryRow = CategoryRow & { visualColor: string; percent: number };
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

function SummaryPill({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "success" | "danger" }) {
  return (
    <div className="rounded-xl border border-border bg-muted/40 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={tone === "success" ? "mt-1 font-medium text-success" : tone === "danger" ? "mt-1 font-medium text-danger" : "mt-1 font-medium text-card-foreground"}>
        {value}
      </p>
    </div>
  );
}

function CategoryTooltip({ active, row }: { active?: boolean; row?: VisualCategoryRow }) {
  if (!active || !row) return null;

  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-3 text-sm shadow-[0_18px_45px_rgba(15,23,42,0.12)]">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.visualColor }} />
        <p className="font-medium text-card-foreground">{row.name}</p>
      </div>
      <div className="mt-2 flex items-center gap-3 text-muted-foreground">
        <span>{formatCurrency(row.value)}</span>
        <span>{row.percent} %</span>
      </div>
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
  const visibleCategories: VisualCategoryRow[] = categories.slice(0, 8).map((category, index) => ({
    ...category,
    visualColor: SOFT_CATEGORY_COLORS[index % SOFT_CATEGORY_COLORS.length],
    percent: percentNumber(category.value, categoryTotal)
  }));
  const latestComparison = comparison.at(-1);
  const latestIncome = latestComparison?.ingresos ?? 0;
  const latestExpenses = latestComparison?.gastos ?? 0;
  const latestDifference = latestIncome - latestExpenses;

  return (
    <div className="grid gap-5 xl:grid-cols-5">
      <section className="rounded-2xl border border-border bg-card p-6 shadow-[0_12px_30px_rgba(15,23,42,0.04)] dark:shadow-none xl:col-span-3">
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-card-foreground">Gastos netos por categoría</h2>
            <p className="text-sm text-muted-foreground">Categorías del periodo seleccionado.</p>
          </div>
          <p className="text-sm font-medium text-card-foreground">{formatCurrency(categoryTotal)}</p>
        </div>
        {hasCategories ? (
          <div className="grid gap-7 lg:grid-cols-[minmax(220px,0.95fr)_minmax(260px,1.05fr)] lg:items-center">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={visibleCategories} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="86%" paddingAngle={3} stroke="hsl(var(--card))" strokeWidth={4} isAnimationActive animationDuration={180}>
                    {visibleCategories.map((entry) => (
                      <Cell key={entry.name} fill={entry.visualColor} className="transition-opacity duration-200 hover:opacity-80" />
                    ))}
                  </Pie>
                  <Tooltip
                    cursor={false}
                    content={(props) => {
                      const row = props.payload?.[0]?.payload as VisualCategoryRow | undefined;
                      return <CategoryTooltip active={props.active} row={row} />;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3">
              {visibleCategories.map((category) => (
                <div key={category.name} className="group rounded-2xl border border-border bg-background px-4 py-3 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(15,23,42,0.05)] dark:bg-muted/20 dark:shadow-none">
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: category.visualColor }} />
                      <span className="truncate font-medium text-card-foreground">{category.name}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 text-muted-foreground">
                      <span>{formatCurrency(category.value)}</span>
                      <span className="w-10 text-right">{formatPercent(category.value, categoryTotal)}</span>
                    </div>
                  </div>
                  <div className="mt-3 h-1.5 rounded-full bg-muted">
                    <div className="h-full rounded-full transition-all duration-200" style={{ width: `${category.percent}%`, backgroundColor: category.visualColor }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 text-sm text-muted-foreground">Sin movimientos de gasto</div>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-[0_12px_30px_rgba(15,23,42,0.04)] dark:shadow-none xl:col-span-2">
        <div className="mb-5">
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
                <Bar dataKey="ingresos" fill="hsl(var(--success))" radius={[6, 6, 0, 0]} />
                <Bar dataKey="gastos" fill="hsl(var(--danger))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 text-sm text-muted-foreground">Sin datos mensuales</div>
          )}
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
          <SummaryPill label="Ingresos" value={formatCurrency(latestIncome)} tone="success" />
          <SummaryPill label="Gastos netos" value={formatCurrency(latestExpenses)} tone="danger" />
          <SummaryPill label="Diferencia" value={formatCurrency(latestDifference)} tone={latestDifference >= 0 ? "success" : "danger"} />
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-[0_12px_30px_rgba(15,23,42,0.04)] dark:shadow-none xl:col-span-5">
        <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-card-foreground">Evolución mensual</h2>
            <p className="text-sm text-muted-foreground">Ingresos reales, gastos netos y resultado</p>
          </div>
          <p className="text-xs text-muted-foreground">Las transferencias internas no se incluyen como gasto ni ingreso real.</p>
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
                <Area dataKey="expenses" name="Gastos netos" stroke="hsl(var(--danger))" fill="transparent" strokeWidth={2} />
                <Area dataKey="savings" name="Ahorro" stroke="hsl(var(--accent))" fill="url(#savingsFill)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 text-sm text-muted-foreground">Sin histórico</div>
          )}
        </div>
      </section>
    </div>
  );
}
