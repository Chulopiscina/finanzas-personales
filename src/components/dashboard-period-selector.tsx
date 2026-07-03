"use client";

import { CalendarDays } from "lucide-react";
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
    <label className="flex w-full flex-col gap-2 rounded-lg border border-border bg-card p-3 shadow-sm sm:w-64">
      <span className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
        <CalendarDays className="h-4 w-4" aria-hidden="true" /> Periodo
      </span>
      <Select value={period} onChange={(event) => changePeriod(event.target.value)} className="h-11 bg-muted/40">
        {Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </Select>
    </label>
  );
}