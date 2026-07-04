"use client";

import { CalendarDays, ChevronDown } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/input";
import type { DashboardPeriod } from "@/lib/finance";

const labels: Record<DashboardPeriod, string> = {
  "last-imported-month": "Último mes importado",
  "last-3-months": "Últimos 3 meses",
  "current-year": "Año actual",
  all: "Todo"
};

export function DashboardPeriodSelector({ period }: { period: DashboardPeriod }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function changePeriod(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "last-imported-month") params.set("period", value);
    else params.delete("period");
    router.push(`/dashboard${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return (
    <label className="group relative flex h-12 min-w-0 items-center gap-3 rounded-full border border-border bg-card px-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition duration-200 hover:border-accent/30 hover:shadow-[0_12px_28px_rgba(15,23,42,0.07)] sm:min-w-56">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-blue-500 dark:text-blue-400">
        <CalendarDays className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="pointer-events-none min-w-0 flex-1 truncate text-sm font-medium text-foreground">{labels[period]}</span>
      <ChevronDown className="pointer-events-none h-4 w-4 shrink-0 text-muted-foreground transition duration-200 group-hover:text-foreground" aria-hidden="true" />
      <Select value={period} onChange={(event) => changePeriod(event.target.value)} aria-label="Seleccionar periodo" className="absolute inset-0 h-full cursor-pointer opacity-0">
        {Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{period === value ? "✓ " : ""}{label}</option>)}
      </Select>
    </label>
  );
}
