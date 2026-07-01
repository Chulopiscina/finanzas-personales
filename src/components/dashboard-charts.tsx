"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { formatCurrency } from "@/lib/format";

type CategoryRow = { name: string; value: number; color: string };
type MonthlyRow = {
  month: string;
  income: number;
  expenses: number;
  savings: number;
  transactions: number;
};

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

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-card-foreground">Gastos por categoría</h2>
          <p className="text-sm text-muted-foreground">Distribución acumulada</p>
        </div>
        <div className="h-80">
          {hasCategories ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categories}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={72}
                  outerRadius={112}
                  paddingAngle={2}
                >
                  {categories.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Sin movimientos</div>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-card-foreground">Ingresos frente a gastos</h2>
          <p className="text-sm text-muted-foreground">Últimos meses importados</p>
        </div>
        <div className="h-80">
          {hasMonthly ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparison}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(value) => `${Number(value) / 1000}k`} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Legend />
                <Bar dataKey="ingresos" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="gastos" fill="hsl(var(--danger))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Sin datos mensuales</div>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-4 shadow-sm xl:col-span-2">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-card-foreground">Evolución mensual y tendencia de ahorro</h2>
          <p className="text-sm text-muted-foreground">Ingresos, gastos y ahorro neto</p>
        </div>
        <div className="h-80">
          {hasMonthly ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthly}>
                <defs>
                  <linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="savingsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(value) => `${Number(value) / 1000}k`} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Legend />
                <Area dataKey="income" name="Ingresos" stroke="hsl(var(--success))" fill="url(#incomeFill)" />
                <Area dataKey="expenses" name="Gastos" stroke="hsl(var(--danger))" fill="transparent" />
                <Area dataKey="savings" name="Ahorro" stroke="hsl(var(--accent))" fill="url(#savingsFill)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Sin histórico</div>
          )}
        </div>
      </section>
    </div>
  );
}
