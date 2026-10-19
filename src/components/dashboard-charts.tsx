"use client";

import { useId, useState } from "react";
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
  YAxis,
} from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChartNoAxesCombined,
  CircleDot,
} from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

const axisStyle = { fill: "hsl(var(--muted-foreground))", fontSize: 11 };
const palette = [
  "#65d9aa",
  "#82b2e8",
  "#e4b77d",
  "#b4a0db",
  "#db8f9e",
  "#7fc5c1",
  "#c4ca89",
  "#a5b5cc",
];
type CategoryRow = { name: string; value: number; color: string };
type MonthlyRow = {
  month: string;
  income: number;
  expenses: number;
  savings: number;
  transactions: number;
};
type TrendKey = "savings" | "income" | "expenses";
const trendLabels: Record<TrendKey, string> = {
  savings: "Resultado",
  income: "Ingresos",
  expenses: "Gastos netos",
};
const trendColors: Record<TrendKey, string> = {
  savings: "#82b2e8",
  income: "#65d9aa",
  expenses: "#db8f9e",
};

function MoneyTooltip({
  active,
  label,
  payload,
}: {
  active?: boolean;
  label?: string | number;
  payload?: ReadonlyArray<{
    name?: string | number;
    value?: unknown;
    color?: string;
  }>;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3 text-xs shadow-xl">
      <p className="mb-2 font-medium text-muted-foreground">{label}</p>
      {payload.map((row, index) => (
        <div
          key={index}
          className="flex items-center justify-between gap-5 py-1"
        >
          <span className="flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: row.color }}
            />
            {row.name}
          </span>
          <strong className="tabular-nums">
            {formatCurrency(Number(row.value))}
          </strong>
        </div>
      ))}
    </div>
  );
}

export function DashboardCharts({
  categories,
  monthly,
  comparison,
}: {
  categories: CategoryRow[];
  monthly: MonthlyRow[];
  comparison: Array<{ month: string; gastos: number; ingresos: number }>;
}) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [trend, setTrend] = useState<TrendKey>("savings");
  const gradient = useId().replace(/:/g, "");
  const categoryTotal =
    categories.reduce((sum, row) => sum + Math.round(row.value * 100), 0) / 100;
  const positiveTotal =
    categories
      .filter((row) => row.value > 0)
      .reduce((sum, row) => sum + Math.round(row.value * 100), 0) / 100;
  const rows = categories.map((row, index) => ({
    ...row,
    visualColor: palette[index % palette.length],
    percent:
      positiveTotal > 0
        ? Math.round((Math.max(0, row.value) / positiveTotal) * 100)
        : 0,
  }));
  const activeName = hoveredCategory ?? selectedCategory;
  const activeRow = rows.find((row) => row.name === activeName);
  const latest = comparison.at(-1);

  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-12">
      <section
        className="chart-surface surface p-5 sm:p-6 xl:col-span-7"
        aria-label="Distribución de gastos"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow">Distribución</p>
            <h2 className="text-base font-semibold">
              Gastos netos por categoría
            </h2>
          </div>
          <CircleDot
            className="mt-1 h-5 w-5 text-muted-foreground"
            aria-hidden="true"
          />
        </div>
        {rows.length ? (
          <div className="mt-5 grid min-w-0 items-center gap-4 md:grid-cols-[minmax(180px,.9fr)_minmax(0,1.1fr)] xl:grid-cols-1 2xl:grid-cols-[minmax(180px,.9fr)_minmax(0,1.1fr)]">
            <div className="relative h-60 min-w-0">
              {positiveTotal > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart accessibilityLayer>
                    <Pie
                      data={rows.filter((row) => row.value > 0)}
                      dataKey="value"
                      nameKey="name"
                      innerRadius="76%"
                      outerRadius="94%"
                      paddingAngle={3}
                      cornerRadius={4}
                      stroke="none"
                      isAnimationActive={false}
                      onMouseEnter={(_, index) =>
                        setHoveredCategory(
                          rows.filter((row) => row.value > 0)[index]?.name ??
                            null,
                        )
                      }
                      onMouseLeave={() => setHoveredCategory(null)}
                    >
                      {rows
                        .filter((row) => row.value > 0)
                        .map((row) => (
                          <Cell
                            key={row.name}
                            fill={row.visualColor}
                            opacity={
                              activeName && activeName !== row.name ? 0.25 : 1
                            }
                            className="transition-opacity duration-150"
                          />
                        ))}
                    </Pie>
                    <Tooltip
                      content={(props) => {
                        const row = props.payload?.[0]?.payload as
                          | (typeof rows)[number]
                          | undefined;
                        return props.active && row ? (
                          <div className="rounded-lg border border-border bg-card p-3 text-xs shadow-xl">
                            <p className="font-medium">{row.name}</p>
                            <p className="mt-1 tabular-nums text-muted-foreground">
                              {formatCurrency(row.value)} · {row.percent} %
                            </p>
                          </div>
                        ) : null;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : null}
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-10 text-center">
                <span className="max-w-full truncate text-xs text-muted-foreground">
                  {activeRow?.name ?? "Gasto neto"}
                </span>
                <strong className="mt-2 text-2xl font-semibold tabular-nums">
                  {formatCurrency(activeRow?.value ?? categoryTotal)}
                </strong>
                <span className="mt-2 text-[11px] text-muted-foreground">
                  {activeRow
                    ? `${activeRow.percent} % del gasto positivo`
                    : "Periodo seleccionado"}
                </span>
              </div>
            </div>
            <div
              className="max-h-80 overflow-y-auto"
              aria-label="Leyenda de categorías"
            >
              {rows.map((row) => (
                <button
                  type="button"
                  key={row.name}
                  aria-pressed={selectedCategory === row.name}
                  onClick={() =>
                    setSelectedCategory(
                      selectedCategory === row.name ? null : row.name,
                    )
                  }
                  onMouseEnter={() => setHoveredCategory(row.name)}
                  onMouseLeave={() => setHoveredCategory(null)}
                  className={cn(
                    "chart-legend-row flex w-full items-center gap-3 px-1 py-3 text-left transition-colors hover:bg-muted/30 focus-visible:outline-accent",
                    selectedCategory === row.name && "bg-muted/40",
                  )}
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: row.visualColor }}
                  />
                  <span className="min-w-0 flex-1 truncate text-xs font-medium">
                    {row.name}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums">
                    {formatCurrency(row.value)}
                  </span>
                  <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                    {row.value < 0 ? "Reemb." : `${row.percent} %`}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="empty-state mt-5">
            <CircleDot className="h-8 w-8 text-muted-foreground" />
            <p>Sin movimientos de gasto en este periodo.</p>
          </div>
        )}
      </section>

      <section className="chart-surface surface p-5 sm:p-6 xl:col-span-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow">Flujo de dinero</p>
            <h2 className="text-base font-semibold">
              Ingresos frente a gastos
            </h2>
          </div>
          <ChartNoAxesCombined
            className="mt-1 h-5 w-5 text-muted-foreground"
            aria-hidden="true"
          />
        </div>
        <div className="mt-4 flex gap-4 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#65d9aa]" />
            Ingresos reales
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#db8f9e]" />
            Gastos netos
          </span>
        </div>
        <div className="mt-6 h-60 min-w-0">
          {comparison.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={comparison}
                barGap={5}
                maxBarSize={28}
                margin={{ top: 8, right: 0, left: -22, bottom: 0 }}
                accessibilityLayer
              >
                <CartesianGrid
                  stroke="hsl(var(--border))"
                  strokeDasharray="2 5"
                  vertical={false}
                />
                <XAxis
                  dataKey="month"
                  tick={axisStyle}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={25}
                />
                <YAxis
                  tickFormatter={(value) =>
                    new Intl.NumberFormat("es-ES", {
                      notation: "compact",
                      maximumFractionDigits: 1,
                    }).format(Number(value))
                  }
                  tick={axisStyle}
                  tickLine={false}
                  axisLine={false}
                  width={62}
                />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted) / .5)", radius: 4 }}
                  content={(props) => <MoneyTooltip {...props} />}
                />
                <Bar
                  name="Ingresos reales"
                  dataKey="ingresos"
                  fill="#65d9aa"
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                />
                <Bar
                  name="Gastos netos"
                  dataKey="gastos"
                  fill="#db8f9e"
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state h-full">Sin datos mensuales.</div>
          )}
        </div>
        <div className="mt-5 border-t border-border pt-4">
          <p className="mb-3 text-[11px] text-muted-foreground">
            {latest ? `Resumen · ${latest.month}` : "Sin periodo disponible"}
          </p>
          <dl className="grid grid-cols-3 gap-2">
            {[
              {
                label: "Ingresos",
                value: latest?.ingresos ?? 0,
                tone: "text-success",
              },
              {
                label: "Gastos netos",
                value: latest?.gastos ?? 0,
                tone: "text-danger",
              },
              {
                label: "Diferencia",
                value: (latest?.ingresos ?? 0) - (latest?.gastos ?? 0),
                tone: "text-foreground",
              },
            ].map((row) => (
              <div key={row.label}>
                <dt className="text-[10px] text-muted-foreground">
                  {row.label}
                </dt>
                <dd
                  className={cn(
                    "mt-1 break-words text-sm font-semibold tabular-nums",
                    row.tone,
                  )}
                >
                  {formatCurrency(row.value)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="chart-surface surface p-5 sm:p-6 xl:col-span-12">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="eyebrow">Perspectiva</p>
            <h2 className="text-base font-semibold">Evolución mensual</h2>
          </div>
          <div
            role="group"
            aria-label="Serie de evolución"
            className="flex self-start rounded-lg border border-border p-1"
          >
            {(Object.keys(trendLabels) as TrendKey[]).map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={trend === key}
                onClick={() => setTrend(key)}
                className={cn(
                  "rounded-md px-3 py-2 text-xs transition-colors focus-visible:outline-accent",
                  trend === key
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {trendLabels[key]}
              </button>
            ))}
          </div>
        </div>
        <div className="my-4 flex items-center gap-2 text-xs text-muted-foreground">
          {trend === "expenses" ? (
            <ArrowDownRight className="h-4 w-4 text-danger" />
          ) : (
            <ArrowUpRight className="h-4 w-4 text-accent" />
          )}
          <span>
            {trendLabels[trend]} mensual · sin transferencias internas
          </span>
        </div>
        <div className="h-64 sm:h-72">
          {monthly.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={monthly}
                margin={{ top: 12, right: 8, left: -22, bottom: 0 }}
                accessibilityLayer
              >
                <defs>
                  <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor={trendColors[trend]}
                      stopOpacity={0.2}
                    />
                    <stop
                      offset="100%"
                      stopColor={trendColors[trend]}
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  stroke="hsl(var(--border))"
                  strokeDasharray="2 5"
                  vertical={false}
                />
                <XAxis
                  dataKey="month"
                  tick={axisStyle}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={30}
                />
                <YAxis
                  tick={axisStyle}
                  tickLine={false}
                  axisLine={false}
                  width={62}
                  tickFormatter={(value) =>
                    new Intl.NumberFormat("es-ES", {
                      notation: "compact",
                      maximumFractionDigits: 1,
                    }).format(Number(value))
                  }
                />
                <Tooltip content={(props) => <MoneyTooltip {...props} />} />
                <Area
                  type="linear"
                  name={trendLabels[trend]}
                  dataKey={trend}
                  stroke={trendColors[trend]}
                  fill={`url(#${gradient})`}
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: trendColors[trend], strokeWidth: 0 }}
                  activeDot={{
                    r: 6,
                    stroke: "hsl(var(--card))",
                    strokeWidth: 3,
                  }}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state h-full">
              No hay histórico para este periodo.
            </div>
          )}
        </div>
        <details className="mt-5 border-t border-border pt-4 text-xs">
          <summary className="w-fit cursor-pointer text-muted-foreground hover:text-foreground">
            Ver datos de los gráficos
          </summary>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr>
                  {["Mes", "Ingresos", "Gastos netos", "Resultado"].map(
                    (label) => (
                      <th key={label} className="p-2">
                        {label}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {monthly.map((row) => (
                  <tr key={row.month} className="border-b border-border">
                    <td className="p-2">{row.month}</td>
                    <td className="p-2">{formatCurrency(row.income)}</td>
                    <td className="p-2">{formatCurrency(row.expenses)}</td>
                    <td className="p-2">{formatCurrency(row.savings)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>
    </div>
  );
}
